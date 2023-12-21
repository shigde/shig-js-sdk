# Shig Core

Shig Core is an AngularJS library designed to serve as the foundation for the Shig Lobby.
It can be also seamlessly integrated into an Angular application. 
If you are not using Angular, utilize the JavaScript SDK directly via [Lobby web component](https://github.com/shigde/shig-js-sdk).

## Install

```
npm i @shig/core
```

## Integrate the Shig Lobby component

Shig Core is used in [Shig Web Client](https://github.com/shigde/web-client). Please use the [Shig Web Client](https://github.com/shigde/web-client) as a reference.

To display a Shig Lobby  component in your app you need to import the ShigModule by adding the following lines to your app.module.ts file.

```typescript
import { ShigModule } from '@shig/core';

@NgModule({
    imports: [
        ShigModule,
    ]
})
class AppModule {
}
```

Add the ```<shig-lobby>``` tag to your own component html like so:

```html

<shig-lobby [stream]="streamId" [space]="spaceId" [token]="userToken" [api-prefix]="" [user]=user-id"></shig-lobby>
```

#### Shig Lobby Components Parameters:

| Parameter  | Description                                                                                           |
|------------|-------------------------------------------------------------------------------------------------------|
| stream     | UUID for the stream, such as the ActivityPub stream UUID.                                             |
| space      | Space Identifier, such as a UUID or the ActivityPub Channel Identifier like `mychannel@video.shig.de` |
| token      | JWT user token provided by the Shig instance                                                          |
| api-prefix | Prefix path for the Shig REST API. Useful when the API is behind a proxy.                             |
| user       | Current user Identifier, such as a ActivityPub  Identifier like `user@video.shig.de`                  |

## Build

Run `ng build core` from root directory to build the project. The build artifacts will be stored in the `dist/core` directory.
