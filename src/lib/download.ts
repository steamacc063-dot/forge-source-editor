/** Export local text through a short-lived object URL; never sends data to a server. */
export function download(text: string, name: string) {
  const blob = new Blob([text], { type: 'text/plain' }),
    url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
