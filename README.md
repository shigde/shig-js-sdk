# shig-js-sdk

Shig Client-Server SDK for JavaScript

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Build Core lib

Run `npm run build:core` or run `ng build core` to build the core library. The build artifacts will be stored in the `dist/` directory.

## Build Lobby web component

Run `npm run build:lobby` to build the lobby web component. The build `shig-lobby.js` artifacts will be stored in
the `dist/` directory.

### Use web component

```html
<!DOCTYPE html>
<html lang="en">
<head></head>
<body>
<div id="wrapper"></div>
<script type="text/javascript" src="./shig-lobby.js"></script>
<script type="text/javascript">
  const lobby = document.createElement('shig-lobby');
  lobby.addEventListener('loadComp', (event) => {
    console.log("Component loaded successfully!", event);
  });
  // lobby.setAttribute('server', 'https://lobby.shig.de/');
  const wrapper = document.getElementById("wrapper");
  wrapper.appendChild(lobby);
</script>
</body>
</html>
```
