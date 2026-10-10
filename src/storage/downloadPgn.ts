export function downloadPgn(pgn: string) {
  const url = URL.createObjectURL(new Blob([pgn], {type:'application/x-chess-pgn;charset=utf-8'}));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'chess-lab.pgn';
  document.body.append(anchor); anchor.click(); anchor.remove();
  // Let the browser begin the download before releasing its source.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
