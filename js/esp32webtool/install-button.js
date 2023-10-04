const e = async t => { 
    let n; 
    import("./install-dialog-30d74d24.js"); 
    try { 
        n = await navigator.serial.requestPort() 
    } 
    catch (n) { 
        return "NotFoundError" === n.name ? void import("./index-832327ec.js").then((n => n.openNoPortPickedDialog((() => e(t))))) : void alert(`Error: ${n.message}`) 
    } 
    
    if (!n) return; 
    
    try { 
        await n.open({ baudRate: 115200 }) 
    } 
    catch (e) { 
        return void alert(e.message) 
    } 
    
    const o = document.createElement("ewt-install-dialog"); 
    o.port = n, 
    o.manifestPath = t.manifest || t.getAttribute("manifest"), 
    o.overrides = t.overrides, 
    o.addEventListener("closed", (() => { n.close() }), { once: !0 }), 
    document.body.appendChild(o) }; 
    
    class t extends HTMLElement { 
        connectedCallback() { 
            if (this.renderRoot) return;

            this.renderRoot = this;

            if (!t.isSupported || !t.isAllowed) return this.toggleAttribute("install-unsupported", !0),
             void (this.renderRoot.innerHTML = t.isAllowed ? 
                "<slot name='unsupported'>Your browser does not support installing things on ESP devices. Use Google Chrome or Microsoft Edge.</slot>" : 
                "<slot name='not-allowed'>You can only install ESP devices on HTTPS websites or on the localhost.</slot>"); 
                
                this.toggleAttribute("install-supported", !0); 
                
                const n = document.createElement("slot"); 
                
                n.addEventListener("click", (async t => { t.preventDefault(), e(this) })), n.name = "activate"; const o = document.createElement("button"); o.setAttribute("id", "esp_installer"); if (o.innerText = "Install", n.append(o), "adoptedStyleSheets" in Document.prototype && "replaceSync" in CSSStyleSheet.prototype) { const e = new CSSStyleSheet; e.replaceSync(t.style), this.renderRoot.adoptedStyleSheets = [e] } else { const e = document.createElement("style"); e.innerText = t.style, this.renderRoot.append(e) } this.renderRoot.append(n) } } t.isSupported = "serial" in navigator, t.isAllowed = window.isSecureContext, t.style = "", customElements.define("esp-web-install-button", t);
