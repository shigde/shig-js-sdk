import Dexie from 'dexie';
import {from, Observable} from 'rxjs';
import {Injectable} from '@angular/core';
import {DeviceSettings} from '../entities';
import {createLogger} from './logger';


@Injectable({
  providedIn: 'root'
})
export class LocalStoreService {
  private readonly log = createLogger('LocalStoreService');
  private readonly STORAGE_KEY = 'media.devices';

  loadReplayDefault(userUuid: string): boolean {
    try {
      return localStorage.getItem(`media.replay-default.${userUuid}`) === 'true';
    } catch {
      return false;
    }
  }

  saveReplayDefault(userUuid: string, enabled: boolean): void {
    try {
      localStorage.setItem(`media.replay-default.${userUuid}`, String(enabled));
    } catch (error) {
      this.log.error('save replay default', error);
    }
  }

  loadDevicesSettings(): DeviceSettings | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      this.log.info('load media devices from store', raw);
      return !raw ? null : DeviceSettings.fromJSON(JSON.parse(raw));
    } catch {
      this.log.error('load media devices');
      return null;
    }
  }

  saveDevicesSettings(devices: DeviceSettings): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(devices));
    } catch (e) {
      this.log.error('save media devices', e);
    }
  }
}
