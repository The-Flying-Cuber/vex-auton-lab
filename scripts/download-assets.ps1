$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$distDir = Join-Path $projectDir 'vendor/site'
$origin = 'https://sim.robostem.org'
$paths = [Collections.Generic.HashSet[string]]::new()
foreach ($path in @('/asset-manifest.json', '/assets/modulepreload-polyfill-B5Qt9EMX.js', '/models/pin.glb', '/models/cup.glb', '/models/goal_tall.glb', '/models/goal_neutral.glb', '/models/goal_alliance.glb', '/models/matchloader.glb', '/models/Large_Warehouse/Large_Warehouse.gltf', '/sounds/cat-meow.mp3', '/images/logo-ui.png', '/images/override.png')) { [void]$paths.Add($path) }
$html = [IO.File]::ReadAllText((Join-Path $projectDir 'vendor/index.html'))
foreach ($match in [regex]::Matches($html, '(?:src|href)=["''](/images/[^"'']+)["'']')) { [void]$paths.Add($match.Groups[1].Value) }
$queue = [Collections.Generic.Queue[string]]::new()
foreach ($path in $paths) { $queue.Enqueue($path) }
while ($queue.Count -gt 0) {
    $path = $queue.Dequeue()
    $target = Join-Path $distDir $path.TrimStart('/')
    [IO.Directory]::CreateDirectory((Split-Path -Parent $target)) | Out-Null
    if (-not (Test-Path -LiteralPath $target)) { Invoke-WebRequest -Uri ($origin + $path) -OutFile $target -UseBasicParsing }
    Write-Output ($path + ' ' + (Get-Item -LiteralPath $target).Length)
    if ($path.EndsWith('.gltf')) {
        $gltf = [IO.File]::ReadAllText($target) | ConvertFrom-Json
        $base = $path.Substring(0, $path.LastIndexOf('/') + 1)
        foreach ($resource in @($gltf.buffers) + @($gltf.images)) {
            if ($resource.uri -and -not $resource.uri.StartsWith('data:')) {
                $dependency = $base + $resource.uri
                if ($paths.Add($dependency)) { $queue.Enqueue($dependency) }
            }
        }
    }
}
