import requests
import time

def simulate_jira_webhook(issue_id, labels):
    print(f"[{time.strftime('%X')}] Triggering Webhook for {issue_id}...")
    print(f"Adding labels: {labels}")
    time.sleep(1)
    print("✅ Successfully updated Jira issue.")

if __name__ == "__main__":
    simulate_jira_webhook("SPRINT-1024", ["waiting-sign-off-system-analyst"])
