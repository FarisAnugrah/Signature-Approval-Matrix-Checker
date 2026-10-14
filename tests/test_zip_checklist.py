import io
import json
import stat
import zipfile
from pathlib import Path

from src.core.zip_checklist import MAX_MEMBER, discover, inspect_archive, validate_options

RULES = json.loads((Path(__file__).resolve().parents[1] / "config/nmb_checklist.json").read_text())["tree"]


def archive(entries):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as output:
        for path, data in entries:
            output.writestr(path, data)
    buffer.seek(0)
    return zipfile.ZipFile(buffer)


def rejects(callback):
    try:
        callback()
    except ValueError as error:
        return str(error)
    raise AssertionError("Expected validation failure")


def test_checklists():
    for root in ("Unrelated 2049/Alpha", "Project", ""):
        prefix = root + "/" if root else ""
        with archive([(prefix + "pengadaan/a.txt", "a"), (prefix + "aks/", ""),
                      (prefix + "different/b.txt", "b"), (prefix + "empty/deep/", "")]) as source:
            result = inspect_archive(source, {}, RULES)
            project = result["projects"][root]
            items = {i["path"]: i for i in project["items"]}
            assert items["pengadaan"]["status"] == "Ditemukan"
            assert items["aks"]["status"] == "Folder kosong"
            assert items["brd"]["status"] == "Perlu pemetaan"
            assert project["percent"] is None
            assert any(n["path"] == prefix + "empty/deep" and n["empty"] for n in result["tree"])
            mapped = inspect_archive(source, {"roots": [root], "mapping": {root: {"brd": "different", "aks": None}}}, RULES)
            items = {i["path"]: i for i in mapped["projects"][root]["items"]}
            assert items["brd"]["status"] == "Ditemukan"
            assert items["aks"]["status"] == "Belum ditemukan"
            assert items["brd"]["signature_analysis"]["status"] == "NO_PDF"
            inventory = inspect_archive(source, {"mode": "inventory"}, RULES)
            assert inventory["projects"][""]["items"] == []
            assert inventory["projects"][""]["percent"] is None
            assert inventory["projects"][""]["completeness_score"] is None
            custom = inspect_archive(source, {"mode": "custom", "categories": ["different", "empty/deep"]}, RULES)
            assert custom["projects"][root]["completeness_score"] == "1/2"
            assert custom["projects"][root]["percent"] == 50
            rejects(lambda: inspect_archive(source, {"roots": ["nonexistent"]}, RULES))
            rejects(lambda: inspect_archive(source, {"roots": [root], "mapping": {root: {"brd": "nonexistent"}}}, RULES))
    with archive([("anything/empty/", ""), ("loose.txt", "x"), (".hidden", "y")]) as source:
        result = inspect_archive(source, {"mode": "inventory"}, RULES)
        assert len(result["tree"]) == 4
        assert any(n["path"] == ".hidden" for n in result["tree"])
        custom = inspect_archive(source, {"mode": "custom", "categories": ["required"], "roots": ["anything"], "mapping": {"anything": {"required": "empty"}}}, RULES)
        assert custom["projects"]["anything"]["items"][0]["status"] == "Folder kosong"
    with archive([]) as source:
        assert inspect_archive(source, {"mode": "inventory"}, RULES)["tree"] == []
    with archive([("unknown/One/aks/a", "x"), ("unknown/Two/pengadaan/b", "x")]) as source:
        assert set(inspect_archive(source, {}, RULES)["projects"]) == {"unknown/One", "unknown/Two"}
    with archive([("P/mybrd/a", "x"), ("P/BRD/", ""), ("P/brd/", "")]) as source:
        item = next(i for i in inspect_archive(source, {"roots": ["P"]}, RULES)["projects"]["P"]["items"] if i["path"] == "brd")
        assert item["status"] == "Perlu pemetaan"
    with archive([("P/brd/a.pdf", "x"), ("P/brd/b.pdf", "x")]) as source:
        items = {i["path"]: i for i in inspect_archive(source, {}, RULES)["projects"]["P"]["items"]}
        assert items["brd"]["signature_analysis"]["status"] == "MULTIPLE_PDFS"
    with archive([("2605022022A_SPRINT/02. BRD/brd.pdf", "x"), ("2605022022A_SPRINT/00. Pengadaan/", "")]) as source:
        res = inspect_archive(source, {}, RULES)
        assert "2605022022A_SPRINT" in res["projects"]
        items = {i["path"]: i for i in res["projects"]["2605022022A_SPRINT"]["items"]}
        assert items["brd"]["status"] == "Ditemukan"
        assert items["pengadaan"]["status"] == "Folder kosong"
    with archive([
        ("Indihome/03. Requirement Gathering/FSD TSD/Functional_Specification_Document.pdf", "x"),
        ("Indihome/03. Requirement Gathering/FSD TSD/Technical_Specification_Document.pdf", "y"),
        ("Indihome/03. Requirement Gathering/Security Assessment/Security Checklist/", ""),
        ("Indihome/03. Requirement Gathering/Security Assessment/Security Kuesioner/kuesioner.pdf", "z")
    ]) as source:
        res = inspect_archive(source, {}, RULES)
        items = {i["path"]: i for i in res["projects"]["Indihome"]["items"]}
        assert items["requirement gathering/fsd"]["status"] == "Ditemukan"
        assert items["requirement gathering/tsd"]["status"] == "Ditemukan"
        assert items["requirement gathering/security asessement/security checklist"]["status"] == "Folder kosong"
        assert items["requirement gathering/security asessement/security kuisoner"]["status"] == "Ditemukan"
    with archive([
        ("Project/00. Pengadaan/", ""),
        ("Project/05. Functional Testing & Non Functional Testing/SIT/Berita Acara SIT - SPRINT.pdf", "x"),
        ("Project/05. Functional Testing & Non Functional Testing/UAT/BA UAT - New Mobile.pdf", "y")
    ]) as source:
        res = inspect_archive(source, {}, RULES)
        items = {i["path"]: i for i in res["projects"]["Project"]["items"]}
        assert items["functional testing & non functional testing/sit/ba sit"]["status"] == "Ditemukan"
        assert items["functional testing & non functional testing/uat/ba uat"]["status"] == "Ditemukan"
    with archive([
        ("Iloan/00. Pengadaan/", ""),
        ("Iloan/04. Development/UT/(Full Signed)2601080080A_Iloan Consumer_UT.pdf", "x"),
        ("Iloan/04. Development/UT/Berita Acara UT.pdf", "ba"),
        ("Iloan/06. Deployment/Form SRM & Memo/Form Promote.pdf", "y")
    ]) as source:
        res = inspect_archive(source, {}, RULES)
        items = {i["path"]: i for i in res["projects"]["Iloan"]["items"]}
        assert items["development/ut"]["status"] == "Ditemukan"
        assert items["development/ut/ba ut"]["status"] == "Ditemukan"
        assert items["deployment/form promote & memo"]["status"] == "Ditemukan"
    with archive([
        ("Sprint/00. Pengadaan/", ""),
        ("Sprint/05. Functional & Non Functional Testing/System Testing/BA ST/Berita Acara ST - SPRINT.pdf", "x"),
        ("Sprint/06. Deployment/POK/Core/POK Promote.pdf", "y"),
        ("Sprint/06. Deployment/POK/Core/POK Rollback.pdf", "z")
    ]) as source:
        res = inspect_archive(source, {}, RULES)
        items = {i["path"]: i for i in res["projects"]["Sprint"]["items"]}
        assert items["functional testing & non functional testing/system testing/ba st"]["status"] == "Ditemukan"
        assert items["deployment/pok/pok promote"]["status"] == "Ditemukan"
        assert items["deployment/pok/pok rollback"]["status"] == "Ditemukan"
        assert items["development/ut"]["status"] == "Perlu pemetaan"


def test_boundaries():
    for options in ({"mode": "bad"}, {"mode": "custom", "categories": []},
                    {"mode": "custom", "categories": ["../x"]},
                    {"mode": "custom", "categories": ["A", "a"]},
                    {"roots": "abc"}, {"mapping": {"": {"unknown": "x"}}}, []):
        rejects(lambda: validate_options(options, RULES))
    for path in ("../bad", "/absolute", "C:/bad", "a\\b", "a/../b", "a//b", "a/./b", "a/\nb"):
        with archive([(path, "x")]) as source:
            rejects(lambda: discover(source))
    link = zipfile.ZipInfo("link")
    link.create_system = 3
    link.external_attr = (stat.S_IFLNK | 0o777) << 16
    with archive([(link, "target")]) as source:
        rejects(lambda: discover(source))
    with archive([("a", "x"), ("a/b", "x")]) as source:
        rejects(lambda: discover(source))
    with archive([("a", "x")]) as source:
        info = source.infolist()[0]
        info.file_size = 38631862
        info.compress_size = 38631862
        discover(source)
        info.file_size = MAX_MEMBER + 1
        assert rejects(lambda: discover(source)) == "ZIP member 'a' exceeds 50 MiB limit: 52428801 bytes expanded"
        info.file_size = 201
        for compressed_size in (0, 1):
            info.compress_size = compressed_size
            assert rejects(lambda: discover(source)) == "ZIP member 'a' exceeds 200x compression ratio limit: 201x"
        info.file_size = 200
        discover(source)
        info.file_size = 1
        info.flag_bits |= 1
        rejects(lambda: discover(source))
    with archive([(str(i), "x") for i in range(11)]) as source:
        for info in source.infolist():
            info.file_size = MAX_MEMBER
            info.compress_size = MAX_MEMBER
        assert rejects(lambda: discover(source)) == "ZIP exceeds 500 MiB total expanded limit at '10': 576716800 bytes expanded"
        source.filelist.pop()
        discover(source)
    with archive([("a", "x")]) as source:
        source.filelist.append(source.filelist[0])
        rejects(lambda: discover(source))
    with archive([("a", "x")]) as source:
        source.filelist *= 10001
        rejects(lambda: discover(source))


if __name__ == "__main__":
    test_checklists()
    test_boundaries()
    print("ZIP discovery, modes, mapping and boundary assertions passed")
