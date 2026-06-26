export type SceneNode = {
  id: string;
  videoId: string;
  video: HTMLVideoElement;

  name: string;
  muted?: boolean;
  cameraOff?: boolean;
  active: boolean;

  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zIndex?: number;
};
