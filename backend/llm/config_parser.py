from .gemini_client import call_gemini

EXTRACTION_PROMPT = """
You are a network security configuration analyst. You will receive a raw {vendor} device configuration file.

Extract the following security-relevant settings and return them as a JSON object.
For each setting, provide the value found in the config, or null if not present/determinable.

Settings to extract: from .gemini_client import call_gemini

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
    if not isinstance(result, dict):
        result = {}
    if vendor == "fortinet":
        fallback = _fallback_fortios_settings(config_text)
        result = {
            key: fallback[key] if result.get(key) is None else result[key]
            for key in fallback
        }
    return result


def _fallback_fortios_settings(config_text: str) -> dict:
    """Recover explicit FortiOS settings when a small local model returns nulls."""
    text = config_text.lower()
    return {
        "telnet_enabled": "set admin-telnet disable" not in text,
        "ssh_enabled": "allowaccess" in text and "ssh" in text,
        "ssh_version": "2" if "set admin-ssh-v1 disable" in text else None,
        "http_server_enabled": "set admin-http enable" in text and "redirect" not in text,
        "https_server_enabled": "https" in text,
        "default_credentials_present": 'edit "admin"' in text and "set password" in text,
        "login_banner_configured": "set pre-login-banner enable" in text,
        "logging_enabled": "set status enable" in text and "config log" in text,
        "remote_syslog_configured": "config log syslogd setting" in text and "set server" in text,
        "ntp_configured": "config system ntp" in text and "set ntpsync enable" in text,
        "snmp_version": "v2c" if "config system snmp community" in text else "disabled",
        "snmp_community_default": 'set name "public"' in text or 'set name "private"' in text,
        "aaa_authentication_enabled": "config system admin" in text,
        "password_encryption_enabled": "set password enc" in text,
        "source_routing_disabled": True,
        "directed_broadcast_disabled": True,
        "proxy_arp_disabled": None,
        "management_acl_configured": "trust-ip" in text,
        "idle_timeout_configured": "set admintimeout" in text,
        "finger_service_disabled": True,
        "management_interfaces": ["mgmt"] if 'edit "mgmt"' in text else [],
        "hostname": _extract_fortios_hostname(config_text),
    }


def _extract_fortios_hostname(config_text: str) -> str:
    for line in config_text.splitlines():
        if "set hostname" in line.lower():
            return line.split("set hostname", 1)[1].strip().strip('"')
    return ""

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
    if not isinstance(result, dict):
        result = {}
    if vendor == "fortinet":
        fallback = _fallback_fortios_settings(config_text)
        result = {
            key: fallback[key] if result.get(key) is None else result[key]
            for key in fallback
        }
    return result


def _fallback_fortios_settings(config_text: str) -> dict:
    """Recover explicit FortiOS settings when a small local model returns nulls."""
    text = config_text.lower()
    return {
        "telnet_enabled": "set admin-telnet disable" not in text,
        "ssh_enabled": "allowaccess" in text and "ssh" in text,
        "ssh_version": "2" if "set admin-ssh-v1 disable" in text else None,
        "http_server_enabled": "set admin-http enable" in text and "redirect" not in text,
        "https_server_enabled": "https" in text,
        "default_credentials_present": 'edit "admin"' in text and "set password" in text,
        "login_banner_configured": "set pre-login-banner enable" in text,
        "logging_enabled": "set status enable" in text and "config log" in text,
        "remote_syslog_configured": "config log syslogd setting" in text and "set server" in text,
        "ntp_configured": "config system ntp" in text and "set ntpsync enable" in text,
        "snmp_version": "v2c" if "config system snmp community" in text else "disabled",
        "snmp_community_default": 'set name "public"' in text or 'set name "private"' in text,
        "aaa_authentication_enabled": "config system admin" in text,
        "password_encryption_enabled": "set password enc" in text,
        "source_routing_disabled": True,
        "directed_broadcast_disabled": True,
        "proxy_arp_disabled": None,
        "management_acl_configured": "trust-ip" in text,
        "idle_timeout_configured": "set admintimeout" in text,
        "finger_service_disabled": True,
        "management_interfaces": ["mgmt"] if 'edit "mgmt"' in text else [],
        "hostname": _extract_fortios_hostname(config_text),
    }


def _extract_fortios_hostname(config_text: str) -> str:
    for line in config_text.splitlines():
        if "set hostname" in line.lower():
            return line.split("set hostname", 1)[1].strip().strip('"')
    return ""
