export const htmlShell = (head, body) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <script src="https://cdn.tailwindcss.com"></script>
  ${head}
  <style>
    @media print {
      header.fixed-header { position: fixed; }
      footer.fixed-footer { position: fixed; }
    }
  </style>
</head>
<body class="text-slate-900">
  ${body}
</body>
</html>`;
