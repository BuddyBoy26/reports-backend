export const htmlShell = (head: string, body: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<script src="https://cdn.tailwindcss.com"></script>
${head}
<style>
@page { size: var(--page-size) var(--page-orientation); margin: var(--page-margin); }
@media print {
  .pagebreak { page-break-after: always; }
  .avoid-break-inside { break-inside: avoid; }
  footer { position: fixed; bottom: 0; left: 0; right: 0; }
  header { position: fixed; top: 0; left: 0; right: 0; }
}
</style>
</head>
<body class="text-slate-900">
${body}
</body>
</html>`;
