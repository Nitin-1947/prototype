from .gemini_client import call_gemini

EXTRACTION_PROMPT = """
You are a network security configuration analyst. You will receive a raw {vendor} device configuration file.

Extract the following security-relevant settings and return them as a JSON object.
For each setting, provide the value found in the config, or null if not present/determinable.

Settings to extract:
- telnet_enabled: boolean (true if telnet is allowed for management)
- ssh_enabled: boolean (true if SSH is configured)
- ssh_version: string (e.g. "2", "1", null)
- http_server_enabled: boolean (true if HTTP management server is enabled)
- https_server_enabled: boolean
- default_credentials_present: boolean (true if default/obvious passwords like "admin", "cisco", "fortinet" are seen)
- login_banner_configured: boolean
- logging_enabled: boolean
- remote_syslog_configured: boolean (true if a syslog server is configured)
- ntp_configured: boolean
- snmp_version: string ("v1", "v2c", "v3", "disabled", or null)
- snmp_community_default: boolean (true if community string is "public" or "private")
- aaa_authentication_enabled: boolean
- password_encryption_enabled: boolean
- source_routing_disabled: boolean (true if ip source-route is disabled)
- directed_broadcast_disabled: boolean
- proxy_arp_disabled: boolean
- management_acl_configured: boolean (true if an ACL restricts management access)
- idle_timeout_configured: boolean (true if VTY/console timeout is set)
- finger_service_disabled: boolean
- management_interfaces: list of strings (interface names used for management)
- hostname: string

Raw {vendor} configuration:
---
{config_text}
---

Return ONLY a valid JSON object with the exact keys listed above. No explanation, no markdown.
"""


async def extract_config_settings(vendor: str, config_text: str) -> dict:
    """
    Use Gemini to extract normalized security settings from raw config text.
    Returns a dict of settings regardless of vendor syntax.
    """
    prompt = EXTRACTION_PROMPT.format(vendor=vendor, config_text=config_text)
    result = await call_gemini(prompt)
    return result if isinstance(result, dict) else {}
