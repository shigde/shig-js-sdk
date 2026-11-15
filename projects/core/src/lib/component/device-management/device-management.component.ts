import {ChangeDetectorRef, Component, DestroyRef, inject, Input, OnInit} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {finalize, map, Observable, of, switchMap, tap} from 'rxjs';
import {Device, DeviceInvite} from '../../entities';
import {DeviceService} from '../../provider/device.service';
import {DeviceInviteQrComponent} from '../device-invite-qr';

@Component({
  selector: 'shig-device-management',
  standalone: true,
  imports: [DeviceInviteQrComponent],
  templateUrl: './device-management.component.html',
  styleUrl: './device-management.component.scss',
})
export class DeviceManagementComponent implements OnInit {
  @Input() streamUuid?: string;

  devices: Device[] = [];
  invitation?: DeviceInvite & {device: Device};
  busy = false;
  loaded = false;
  error = '';
  removeUuid?: string;
  renameUuid?: string;

  private readonly api = inject(DeviceService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.run(this.api.list(), devices => {
      this.devices = devices;
      this.loaded = true;
    });
  }

  create(input: HTMLInputElement): void {
    const name = input.value.trim();
    if (!name || this.devices.length >= 3) return;
    this.run(this.api.create(name).pipe(
      tap(device => {
        this.devices = [...this.devices, device].sort((left, right) => left.slot - right.slot);
        input.value = '';
      }),
      switchMap(device => this.streamUuid ? this.inviteRequest(device, this.streamUuid) : of(undefined)),
    ), invitation => { this.invitation = invitation; });
  }

  invite(device: Device): void {
    if (!this.streamUuid || !device.active) return;
    this.run(this.inviteRequest(device, this.streamUuid), invitation => { this.invitation = invitation; });
  }

  rename(device: Device, name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.run(this.api.update(device.uuid, {name: trimmed}), updated => {
      this.replace(updated);
      this.renameUuid = undefined;
    });
  }

  toggle(device: Device): void {
    this.run(this.api.update(device.uuid, {active: !device.active}), updated => this.replace(updated));
  }

  remove(device: Device): void {
    this.run(this.api.remove(device.uuid), () => {
      this.devices = this.devices.filter(item => item.uuid !== device.uuid);
      this.removeUuid = undefined;
      if (this.invitation?.device.uuid === device.uuid) this.invitation = undefined;
    });
  }

  private inviteRequest(device: Device, streamUuid: string) {
    return this.api.invite(device.uuid, streamUuid).pipe(
      map(invitation => ({...invitation, device})),
    );
  }

  private replace(updated: Device): void {
    this.devices = this.devices.map(device => device.uuid === updated.uuid ? updated : device);
    if (this.invitation?.device.uuid === updated.uuid) {
      this.invitation = updated.active ? {...this.invitation, device: updated} : undefined;
    }
  }

  private run<T>(request: Observable<T>, success: (value: T) => void): void {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
      this.busy = false;
      this.cdr.markForCheck();
    })).subscribe({
      next: success,
      error: error => { this.error = error.error?.message || 'Could not update devices. Please try again.'; },
    });
  }
}
