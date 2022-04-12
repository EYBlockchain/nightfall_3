function loadScript(src) {
  const script = document.createElement('script');
  script.src = src;
  document.body.appendChild(script);
  return new Promise((res, rej) => {
    script.onload = res;
    script.onerror = rej;
  });
}

/* eslint-disable no-restricted-globals */
function loadDemoApp(url) {
  const urlOrLocation = url || location.origin;
  const origin = new URL(urlOrLocation).origin || location.origin;
  const srcList = {
    js: [],
  };
  return fetch(`${urlOrLocation}/asset-manifest.json`)
    .then(response => {
      return response.json();
    })
    .then(assets => {
      // const assets = response.json();
      console.log(assets);
      const { files } = assets;
      if (files !== null) {
        for (const file in files) {
          if ({}.hasOwnProperty.call(files, file)) {
            const path = files[file];
            const splitted = files[file].split('.');
            const last = splitted.pop();
            if (last === 'js') {
              srcList.js.push(path);
            }
          }
        }
      }
      const promises = srcList.js.map(src => {
        return loadScript(origin + src);
      });
      return Promise.all(promises);
    });
}

window.loadDemoApp = loadDemoApp;
