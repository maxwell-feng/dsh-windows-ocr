# Mock OCR runner for standalone tests: same interface as lib/ocr.ps1
# (-ImagePath -OutFile [-Language]), writes fixed text instead of running
# Windows.Media.Ocr, so the full spawn/args/temp-file chain is exercised
# without a language pack. Runs under the real powershell.exe.
param(
    [Parameter(Mandatory = $true)][string]$ImagePath,
    [Parameter(Mandatory = $true)][string]$OutFile,
    [string]$Language = ""
)

$ErrorActionPreference = "Stop"

# Touch the input image to prove bytes flowed through the real temp-dir path.
$bytes = [System.IO.File]::ReadAllBytes($ImagePath)
$text = "Hello OCR 123 ($($bytes.Length) bytes)"
if ($Language -ne "") { $text += " [lang=$Language]" }

[System.IO.File]::WriteAllText($OutFile, $text, (New-Object System.Text.UTF8Encoding($false)))
exit 0
