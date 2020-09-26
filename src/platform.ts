import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { AgileOctopusAccessory } from './platformAccessory';

export class AgileOctopusPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }
  discoverDevices() {
    const agileDevices = [
      {
        agileUniqueId: 'ABCD',
        agileDisplayName: 'Octopus Rates',
      }
    ];
    for (const device of agileDevices) {
      const uuid = this.api.hap.uuid.generate(device.agileUniqueId);
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
        new AgileOctopusAccessory(this, existingAccessory, this.config);

      } else {
        this.log.info('Adding new accessory:', device.agileDisplayName);
        const accessory = new this.api.platformAccessory(device.agileDisplayName, uuid);

        accessory.context.device = device;
        new AgileOctopusAccessory(this, accessory, this.config);

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}
