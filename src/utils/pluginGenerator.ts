/**
 * Downloads the real Agent Ready Shop WordPress plugin.
 *
 * The zip is assembled server-side from the actual plugin source in
 * /plugin/agent-ready-shop (see server.ts → /api/download-plugin), so the
 * download always matches the shipped plugin — no duplicated inline copy.
 */
export async function downloadPlugin() {
  const link = document.createElement('a');
  link.href = '/api/download-plugin';
  link.download = 'agent-ready-shop.zip';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
