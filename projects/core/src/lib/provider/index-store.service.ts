import Dexie from 'dexie';
import {from, Observable} from 'rxjs';
import {Injectable} from '@angular/core';
import {DeviceSettings} from '../entities';

const INDEX_DB = 'shig_db';
const DB_VERSION = 1;

@Injectable({
  providedIn: 'root'
})
export class IndexStoreService extends Dexie {
  public settings: Dexie.Table<DeviceSettings, number>; // id is number in this case

  public constructor() {
    super(INDEX_DB);
    this.version(DB_VERSION).stores({settings: DeviceSettings.dbProps()});
    this.settings = this.table('settings');
  }

  save(settings: DeviceSettings): void {
    this.transaction('rw', this.settings, async () => {
      // Make sure we have something in DB:
      if ((await this.settings.where({id: settings.id}).count()) === 0) {
        const id = await this.settings.add({...settings});
      }
    }).catch(e => {
      console.log(e.stack || e);
    });
  }

  update(settings: DeviceSettings): void {

    this.transaction('rw', this.settings, async () => {
      // Make sure we have something in DB:
      if ((await this.settings.where({id: settings.id}).count()) !== 0) {
        const id = await this.settings.put({...settings}, settings.id);
        // this.dialog.open(NoticeDialogComponent, {data: {type: 'success', msg: 'Updated profile!'}});
      }
    }).catch(e => {
      console.log("??????, e")
      // this.dialog.open(NoticeDialogComponent, {data: {type: 'fail', msg: 'Can not update profile!'}});
    });
  }

  isEmpty(): Observable<boolean> {
    return from(this.settings.count().then((count) => count === 0));
  }

  hasSettings(): Observable<boolean> {
    const transaction = this.transaction('r', this.settings, async () => {
      return await this.settings.where({id: 1}).count() !== 0;
    });
    return from(transaction);
  }

  public fetch(): Observable<DeviceSettings> {
    const settingsPromise = this.settings.toArray().then((settings) => settings[0]);
    return from(settingsPromise);
  }

  public get(): Observable<DeviceSettings | undefined> {
    const transaction = this.transaction('r', this.settings, async () => {
      return await this.settings.where({id: 1}).first();
    });
    return from(transaction);
  }
}
