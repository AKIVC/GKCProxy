const NOC = `document.addEventListener('DOMContentLoaded',()=>{
  let d=document.createElement('div');
  d.textContent='SUCCESS - injection worked';
  Object.assign(d.style,{position:'fixed',top:'10px',left:'50%',transform:'translateX(-50%)',padding:'10px 16px',background:'#111',color:'#fff',zIndex:999999,borderRadius:'8px'});
  document.body.prepend(d);
});`;
export default {
    async fetch(req, env) {
        let url = new URL(req.url);
        if (url.pathname === '/noc.js') return new Response(NOC, { headers: { 'content-type': 'text/javascript' } });
        if (req.headers.get('Upgrade') === 'websocket') {
            let [client, server] = Object.values(new WebSocketPair());
            server.accept();
            server.addEventListener('message', async e => {
                let { path } = JSON.parse(e.data);
                let r = await fetch('https://www.gimkit.com' + path);
                server.send(await r.text());
            });
            return new Response(null, { status: 101, webSocket: client });
        }
        let gim = await fetch('https://www.gimkit.com' + url.pathname + url.search, {
            method: req.method, headers: { ...Object.fromEntries(req.headers), host: 'www.gimkit.com', origin: 'https://www.gimkit.com' }, body: req.body
        });
        let headers = new Headers(gim.headers);
        let body = await gim.text();
        if ((headers.get('content-type') || '').includes('text/html')) {
            body = body.replace('<head>', `<head><script src="/noc.js"></script>`)
                .replaceAll('https://www.gimkit.com', 'https://' + url.hostname);
        }
        return new Response(body, { status: gim.status, headers });
    }
}