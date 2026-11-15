export type ScoreboardPreferences = {
  enabled: boolean;
  homeName: string;
  awayName: string;
  homeAbbr: string;
  awayAbbr: string;
  homeColor: string;
  awayColor: string;
  timerMode: 'up' | 'down';
  timerDuration: number;
};

export type SceneChoicePreference = {kind: 'picture-in-picture'} | {kind: 'video'; videoId: string};
export type PictureInPicturePreference = {
  mainId: string;
  insetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type ScenePreferences = {
  choices: Array<SceneChoicePreference | null>;
  pictureInPicture: PictureInPicturePreference | null;
};
export type StreamSettings = {
  scoreboard: ScoreboardPreferences;
  scenes: ScenePreferences;
};
