function replaceRequired(html, current, replacement) {
  if (!html.includes(current)) {
    throw new Error(`Deployment branding could not find expected markup: ${current}`);
  }
  return html.replace(current, replacement);
}

export function transformDeploymentHtml(html, config) {
  if (config.brand.id !== 'philanthropic-xxi') return html;

  const replacements = [
    ['<html lang="en">', '<html lang="en" data-deployment-brand="philanthropic-xxi">'],
    ['<meta name="theme-color" content="#f8f6f1" />', '<meta name="theme-color" content="#E4E7E0" />'],
    [
      '<meta name="description" content="Your communities, their conversations, and ways to take part — in one personal dashboard." />',
      '<meta name="description" content="The Philanthropic XXI member dashboard: community activity, participation, and shared decisions." />',
    ],
    ['<link rel="manifest" href="/manifest.webmanifest" />', '<link rel="manifest" href="/manifest-philanthropic-xxi.webmanifest" />'],
    ['<link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />', '<link rel="icon" href="/icons/philanthropic-xxi.svg" type="image/svg+xml" />'],
    ['<link rel="stylesheet" href="/fonts.css" />', '<link rel="stylesheet" href="/pxxi-fonts.css" />'],
    ['<title>My Community</title>', '<title>Philanthropic XXI</title>'],
  ];

  return replacements.reduce(
    (transformed, [current, replacement]) => replaceRequired(transformed, current, replacement),
    html,
  );
}
