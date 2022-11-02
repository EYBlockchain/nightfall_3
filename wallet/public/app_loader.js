/* Running in Nightfall */
function loadScript(src) {
  const script = document.createElement('script');
  script.src = src.path;
  document.body.appendChild(script);
  return new Promise((res, rej) => {
    script.onload = res;
    script.onerror = rej;
  });
}

function loadStaticScript() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css';
  link.integrity = 'sha384-1BmE4kWBq78iYhFldvKuhfTAU6auU8tT94WrHftjDbrCEXSU1oBoqyl2QvZ6jIW3';
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
  const wwScript = document.createElement('script');
  wwScript.type = 'text/javascript';
  wwScript.innerHTML = `
    (function() {
      var _Worker = window.Worker;
      window.Worker = function (url) {
        var blob = new Blob(["importScripts(" + JSON.stringify(url) + ")"], {
          type: "text/javascript"
        });
        return new _Worker(URL.createObjectURL(blob));
      }
    })();`;
  document.body.appendChild(wwScript);
  return [
    'https://unpkg.com/react/umd/react.production.min.js',
    'https://unpkg.com/react-dom/umd/react-dom.production.min.js',
    'https://unpkg.com/react-bootstrap@next/dist/react-bootstrap.min.js',
  ].map(s => {
    const script = document.createElement('script');
    script.src = s;
    document.body.appendChild(script);
    return new Promise((res, rej) => {
      script.onload = res;
      script.onerror = rej;
    });
  });
}

/* eslint-disable no-restricted-globals */
function loadDemoApp() {
  const srcList = {
    js: [],
  };
  console.log('fetching asset manifest');
  return (
    fetch(`https://wallet.testnet.polygon-nightfall.technology/asset-manifest.json`)
      .then(response => {
        return response.json();
      })
      // eslint-disable-next-line consistent-return
      .then(async assets => {
        // const assets = response.json();
        const { files } = assets;
        if (files !== null) {
          for (const file in files) {
            if ({}.hasOwnProperty.call(files, file)) {
              const path = files[file];
              const splitted = files[file].split('.');
              const last = splitted.pop();
              if (last === 'js') {
                if (splitted.pop() === 'worker') srcList.js.unshift({ type: 'worker', path });
                else srcList.js.push({ type: 'js', path });
              }
            }
          }
        }
        await Promise.all(loadStaticScript());
        try {
          const promises = srcList.js.map(src => {
            return loadScript(src);
          });
          return Promise.all(promises);
        } catch (error) {
          console.log('ERROR LOAD', error);
        }
      })
  );
}

window.loadDemoApp = loadDemoApp;
