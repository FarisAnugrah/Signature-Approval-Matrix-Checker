import re
import stat
import zipfile

MAX_MEMBER = 50 * 1024 * 1024
MAX_TOTAL = 500 * 1024 * 1024
MAX_ENTRIES = 10000


def relative_path(value):
    if not isinstance(value, str) or not value or len(value) > 1024:
        raise ValueError("Invalid relative path")
    parts = value.split("/")
    if len(parts) > 32 or any(p in ("", ".", "..") or not p.strip() for p in parts):
        raise ValueError("Invalid relative path")
    if "\\" in value or ":" in value or any(ord(c) < 32 or ord(c) == 127 for c in value):
        raise ValueError("Unsafe relative path")
    return value


def normalize(value):
    return "/".join(p.strip().casefold() for p in value.split("/"))


def clean_prefix(segment):
    # ponytail: strips numeric prefix like '02.', '02 -', '02 ' for flexible checklist matching
    cleaned = re.sub(r'^\d+[\.\-_ ]*', '', segment.strip())
    s = (cleaned or segment).strip().casefold()
    s = s.replace("assesement", "assessment").replace("asessement", "assessment")
    s = s.replace("kuisoner", "kuesioner")
    s = s.replace("compability", "compatibility")
    s = s.replace("&", "")
    s = re.sub(r'\s+', ' ', s).strip()
    if s == "functional non functional testing":
        s = "functional testing non functional testing"
    return s


def fuzzy_normalize(value):
    return "/".join(clean_prefix(p) for p in value.split("/"))


def is_doc_match(filename, doc_type):
    name = filename.casefold()
    if doc_type == "fsd":
        return bool(re.search(r'(?<![a-z0-9])fsd(?![a-z0-9])|functional[ _-]specification[ _-]document', name))
    if doc_type == "tsd":
        return bool(re.search(r'(?<![a-z0-9])tsd(?![a-z0-9])|technical[ _-]specification[ _-]document', name))
    if doc_type in ("sit", "uat", "ut", "st"):
        # Match "ba ut", "ba sit", "berita acara ut", "berita acara sit", etc.
        pattern = rf'(?:(?<![a-z0-9])ba(?![a-z0-9])|berita[ _-]+acara)[^\n/]*?(?<![a-z0-9]){doc_type}(?![a-z0-9])'
        return bool(re.search(pattern, name))
    if doc_type in ("pok promote", "pok rollback", "pok aplikasi"):
        keyword = doc_type.split()[-1]
        return keyword in name
    return True


def validate_options(options, itp_rules):
    if not isinstance(options, dict) or set(options) - {"mode", "categories", "roots", "mapping"}:
        raise ValueError("Invalid checklist options")
    mode = options.get("mode", "itp")
    if mode not in ("itp", "custom", "inventory"):
        raise ValueError("Invalid checklist mode")
    rules = itp_rules if mode == "itp" else []
    if mode == "custom":
        categories = options.get("categories", [])
        if not isinstance(categories, list) or not 1 <= len(categories) <= 100:
            raise ValueError("Custom checklist requires 1–100 relative folder paths")
        paths = [relative_path(p) for p in categories]
        if len({normalize(p) for p in paths}) != len(paths):
            raise ValueError("Duplicate checklist categories")
        rules = [{"path": p, "required": True} for p in paths]
    roots = options.get("roots", [])
    if not isinstance(roots, list) or len(roots) > 100:
        raise ValueError("Invalid project roots")
    for root in roots:
        if root != "":
            relative_path(root)
    if len(set(roots)) != len(roots):
        raise ValueError("Duplicate project roots")
    mapping = options.get("mapping", {})
    if not isinstance(mapping, dict) or len(mapping) > 100:
        raise ValueError("Invalid folder mapping")
    for root, choices in mapping.items():
        if root != "":
            relative_path(root)
        if not isinstance(choices, dict) or len(choices) > len(rules):
            raise ValueError("Invalid category mapping")
        for category, target in choices.items():
            if category not in {r["path"] for r in rules}:
                raise ValueError("Unknown checklist category")
            if target is not None and target != "":
                relative_path(target)
    return mode, rules, roots, mapping


def discover(archive):
    infos = archive.infolist()
    if len(infos) > MAX_ENTRIES:
        raise ValueError("ZIP exceeds 10,000 entries")
    folders, files, seen = set(), {}, set()
    total = 0
    for info in infos:
        name = info.orig_filename
        path = relative_path(name[:-1] if name.endswith("/") else name)
        if path in seen:
            raise ValueError("Duplicate ZIP path")
        seen.add(path)
        kind = stat.S_IFMT(info.external_attr >> 16)
        if kind not in (0, stat.S_IFREG, stat.S_IFDIR) or (kind == stat.S_IFDIR and not info.is_dir()):
            raise ValueError("ZIP links and special files are not supported")
        if info.flag_bits & 1 or info.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
            raise ValueError("Encrypted or unsupported ZIP compression")
        total += info.file_size
        if info.file_size > MAX_MEMBER:
            raise ValueError(f"ZIP member {path!r} exceeds 50 MiB limit: {info.file_size} bytes expanded")
        if total > MAX_TOTAL:
            raise ValueError(f"ZIP exceeds 500 MiB total expanded limit at {path!r}: {total} bytes expanded")
        if info.file_size > max(info.compress_size, 1) * 200:
            raise ValueError(f"ZIP member {path!r} exceeds 200x compression ratio limit: {info.file_size / max(info.compress_size, 1):g}x")
        parts = path.split("/")
        folders.update("/".join(parts[:i]) for i in range(1, len(parts)))
        if info.is_dir():
            if info.file_size:
                raise ValueError("Directory contains unexpected data")
            folders.add(path)
        else:
            files[path] = info
    if folders.intersection(files) or len(folders) + len(files) > MAX_ENTRIES:
        raise ValueError("Conflicting paths or too many discovered entries")
    return sorted(folders), files


def inspect_archive(archive, options, itp_rules, signature_check=None):
    mode, rules, roots, mapping = validate_options(options, itp_rules)
    folders, files = discover(archive)
    if any(root and root not in folders for root in roots):
        raise ValueError("Project root not found in ZIP")
    if not roots:
        candidates = set()
        for folder in folders:
            normalized = normalize(folder)
            fuzzy = fuzzy_normalize(folder)
            for rule in rules:
                target = normalize(rule["path"])
                target_fuzzy = fuzzy_normalize(rule["path"])
                if normalized == target or normalized.endswith("/" + target):
                    candidates.add("/".join(folder.split("/")[:-len(target.split("/"))]))
                elif fuzzy == target_fuzzy or fuzzy.endswith("/" + target_fuzzy):
                    candidates.add("/".join(folder.split("/")[:-len(target_fuzzy.split("/"))]))
            if fuzzy == "requirement gathering/fsd tsd" or fuzzy.endswith("/requirement gathering/fsd tsd"):
                candidates.add("/".join(folder.split("/")[:-2]))
        roots = sorted(candidates) or [""]
    if len(roots) > 100:
        raise ValueError("Too many project roots; select roots explicitly")
    if set(mapping) - set(roots):
        raise ValueError("Mapping refers to an unselected project root")
    populated = set()
    for path in files:
        parts = path.split("/")
        populated.update("/".join(parts[:i]) for i in range(1, len(parts)))
    tree = [{"path": p, "kind": "folder", "empty": p not in populated} for p in folders]
    tree += [{"path": p, "kind": "file", "size": info.file_size} for p, info in files.items()]
    projects = {}
    signature_count = 0
    for root in roots:
        prefix = root + "/" if root else ""
        relative_folders = [p[len(prefix):] for p in folders if p.startswith(prefix)]
        relative_files = {p[len(prefix):]: info for p, info in files.items() if p.startswith(prefix)}
        choices = mapping.get(root, {})
        if any(target is not None and target not in relative_folders + [""] for target in choices.values()):
            raise ValueError("Mapped folder not found under project root")
        items = []
        for rule in rules:
            category = rule["path"]
            matches = [p for p in relative_folders if normalize(p) == normalize(category)]
            if not matches:
                matches = [p for p in relative_folders if fuzzy_normalize(p) == fuzzy_normalize(category)]
            # Alias deployment/form promote & memo -> form srm & memo
            if not matches and fuzzy_normalize(category).startswith("deployment/form promote"):
                srm_matches = [p for p in relative_folders if fuzzy_normalize(p).startswith("deployment/form srm")]
                if len(srm_matches) == 1:
                    matches = srm_matches
            # Combined FSD TSD fallback
            combined_fsd_tsd = False
            ba_parent_fallback = None
            pok_fallback = None
            if not matches and category in ("requirement gathering/fsd", "requirement gathering/tsd"):
                fsd_tsd_matches = [p for p in relative_folders if fuzzy_normalize(p) == "requirement gathering/fsd tsd"]
                if len(fsd_tsd_matches) == 1:
                    matches = fsd_tsd_matches
                    combined_fsd_tsd = True
            elif not matches and normalize(category).endswith(("/ba ut", "/ba sit", "/ba uat", "/ba st")):
                parent_cat = "/".join(category.split("/")[:-1])
                ba_type = category.split("/")[-1].split()[-1].lower()
                parent_matches = [p for p in relative_folders if fuzzy_normalize(p) == fuzzy_normalize(parent_cat)]
                if len(parent_matches) == 1:
                    matches = parent_matches
                    ba_parent_fallback = ba_type
            elif not matches and category.startswith("deployment/pok/"):
                pok_type = category.split("/")[-1].lower()
                pok_parent_matches = [p for p in relative_folders if fuzzy_normalize(p) == "deployment/pok"]
                if len(pok_parent_matches) == 1:
                    matches = pok_parent_matches
                    pok_fallback = pok_type
            target = choices.get(category, matches[0] if len(matches) == 1 else None)
            confirmed_absent = category in choices and target is None
            if target is not None:
                all_matched = sorted(p for p in relative_files if not target or p.startswith(target + "/"))
                if combined_fsd_tsd:
                    doc_kind = "fsd" if category.endswith("/fsd") else "tsd"
                    matched = [p for p in all_matched if is_doc_match(p.split("/")[-1], doc_kind)]
                elif ba_parent_fallback:
                    matched = [p for p in all_matched if is_doc_match(p.split("/")[-1], ba_parent_fallback)]
                elif pok_fallback:
                    matched = [p for p in all_matched if is_doc_match(p.split("/")[-1], pok_fallback)]
                elif category == "development/ut":
                    matched = [p for p in all_matched if "/" not in p[len(target) + 1:]]
                else:
                    matched = all_matched
            else:
                matched = []
            status = "Belum ditemukan" if confirmed_absent else "Perlu pemetaan" if target is None else "Ditemukan" if matched else "Folder kosong"
            sig = None
            if matched and rule.get("requires_signature"):
                pdfs = [p for p in matched if p.lower().endswith(".pdf")]
                if rule.get("template_type") not in ("BRD", "PCR"):
                    sig = {"status": "UNSUPPORTED"}
                elif not pdfs:
                    sig = {"status": "NO_PDF"}
                elif len(pdfs) != 1:
                    sig = {"status": "MULTIPLE_PDFS"}
                elif signature_check and signature_count < 20:
                    signature_count += 1
                    sig = signature_check(archive, relative_files[pdfs[0]], rule["template_type"])
                    sig["file"] = pdfs[0]
                else:
                    sig = {"status": "NOT_CHECKED"}
            items.append({"path": category, "required": rule.get("required", True), "status": status,
                           "mapped_path": target, "files": matched, "requires_signature": rule.get("requires_signature", False),
                           "signature_analysis": sig})
        is_mobile = any(fuzzy_normalize(folder).endswith(("/android", "/ios")) for folder in relative_folders)
        if not is_mobile:
            for item in items:
                if item["path"].endswith(("/android", "/ios")):
                    item["required"] = False
        required = [i for i in items if i["required"]]
        found = sum(i["status"] == "Ditemukan" for i in required)
        unresolved = sum(i["status"] == "Perlu pemetaan" for i in required)
        projects[root] = {"project_name": root or "ZIP root", "root": root, "folders": relative_folders,
                          "items": items, "unmapped_count": unresolved,
                          "completeness_score": f"{found}/{len(required)}" if mode != "inventory" else None,
                          "percent": round(found / len(required) * 100, 1) if required and not unresolved else None,
                          "missing_signatures_count": sum(i["signature_analysis"] is not None and i["signature_analysis"]["status"] == "PENDING" for i in items)}
    return {"mode": mode, "tree": sorted(tree, key=lambda node: node["path"]), "folders": folders,
            "total_projects": len(projects), "projects": projects}
