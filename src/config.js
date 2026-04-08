const BUNDLED_CONFIG = `
title = "Betterleaks IaC Ruleset"

[extend]
useDefault = true

# --- Terraform / IaC Rules ---

[[rules]]
id = "iac-generic-password"
description = "Generic password assignment in IaC files"
regex = '''(?i)(password|passwd|pwd|secret|token|key)\\s*=\\s*["']([^"']{8,})["']'''
secretGroup = 2
entropy = 3.0
tokenEfficiency = true
keywords = ["password", "passwd", "pwd", "secret", "token", "key"]
path = '''\\.(tf|tfvars|auto\\.tfvars|env|ps1|psm1|psd1|sh|bash)$'''

  [[rules.allowlists]]
  description = "Allow placeholder values"
  regexes = [
    '''(?i)(placeholder|changeme|fake|example|dummy|todo|tbd|<[^>]+>|\\$\\{)'''
  ]

[[rules]]
id = "iac-connection-string"
description = "Database or storage connection string"
regex = '''(?i)(connection[_-]?string|connstr|jdbc)\\s*=\\s*["']([^"']{12,})["']'''
secretGroup = 2
entropy = 3.5
tokenEfficiency = true
keywords = ["connection", "connstr", "jdbc"]

[[rules]]
id = "iac-azure-storage-key"
description = "Azure storage account key pattern"
regex = '''(?i)(account[_-]?key|storage[_-]?key|access[_-]?key)\\s*=\\s*["']([A-Za-z0-9+/]{60,}={0,2})["']'''
secretGroup = 2
entropy = 4.5
keywords = ["account_key", "storage_key", "access_key"]

[[rules]]
id = "iac-sas-token"
description = "Azure SAS token"
regex = '''(?i)sas[_-]?token\\s*=\\s*["'](sv=.{20,})["']'''
secretGroup = 1
keywords = ["sas_token", "sas"]

# --- Global Allowlist ---

[[allowlists]]
description = "Ignore common non-secret file types"
paths = [
  '''\\.(png|jpg|gif|svg|ico|woff|ttf|eot|pdf|lock)$''',
  '''\\.terraform[\\\\/]''',
  '''terraform\\.tfstate''',
  '''\\.vscode[\\\\/]'''
]
`;

module.exports = { BUNDLED_CONFIG };
