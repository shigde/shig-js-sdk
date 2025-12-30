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
  private readonly STORAGE_KEY = 'devices';
  private data: null | DeviceSettings = null;

  public get(): DeviceSettings | null {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as DeviceSettings;
      } catch (e) {
        this.log.error('parsing localStorage device data:', e);
        return null;
      }
    }
    return null;
  }

  save(settings: DeviceSettings): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      this.log.error('save localStorage device data:', e);
    }
  }

  hasSettings(): boolean {
    let data = this.get();
    return data !== null;
  }
}
