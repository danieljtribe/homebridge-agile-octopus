import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { AgileOctopusPlatform } from './platform';
const moment = require('moment');

export class AgileOctopusAccessory {
  private service: Service;

  constructor(
    private readonly platform: AgileOctopusPlatform,
    private readonly accessory: PlatformAccessory,
    private config: any
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Octopus Energy')
      .setCharacteristic(this.platform.Characteristic.Model, 'Agile Octopus')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Agile Octopus');

    this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.agileDisplayName);
    this.init();
  }

  async init() {
    const got = require('got');
    let page: string = `https://api.octopus.energy/v1/products/AGILE-18-02-21/electricity-tariffs/E-1R-AGILE-18-02-21-${this.config.region}/standard-unit-rates/?period_from=${moment().hour() < 16 ? moment().subtract(1, 'day').hour(16).minute(0).toISOString() : moment().hour(16).minute(0).toISOString()}`;
    let body: any = JSON.parse((await got(page)).body);
    body = body.results;

    let switches = [] as any;
    switches.push({blocks: 1, accessory: this.accessory.getService('Cheapest 30m period') || this.accessory.addService(this.platform.Service.Switch, 'Cheapest 30m period', 'c-30')});
    switches.push({blocks: 2, accessory: this.accessory.getService('Cheapest 1hr period') || this.accessory.addService(this.platform.Service.Switch, 'Cheapest 1hr period', 'c-60')});
    switches.push({blocks: 3, accessory: this.accessory.getService('Cheapest 1hr and 30m period') || this.accessory.addService(this.platform.Service.Switch, 'Cheapest 1hr and 30m period', 'c-90')});
    switches.push({blocks: 4, accessory: this.accessory.getService('Cheapest 2hr period') || this.accessory.addService(this.platform.Service.Switch, 'Cheapest 2hr period', 'c-120')});
    switches.push({blocks: 5, accessory: this.accessory.getService('Cheapest 2hr and 30m period') || this.accessory.addService(this.platform.Service.Switch, 'Cheapest 2hr and 30m period', 'c-150')});
    switches.push({blocks: 6, accessory: this.accessory.getService('Cheapest 3hr period') || this.accessory.addService(this.platform.Service.Switch, 'Cheapest 3hr period', 'c-180')});
    switches.push({blocks: 7, accessory: this.accessory.getService('Cheapest 3hr and 30m period') || this.accessory.addService(this.platform.Service.Switch, 'Cheapest 3hr and 30m period', 'c-210')});
    switches.push({blocks: 8, accessory: this.accessory.getService('Cheapest 4hr period') || this.accessory.addService(this.platform.Service.Switch, 'Cheapest 4hr period', 'c-240')});
    /*switches.push({blocks: 9, accessory: this.accessory.getService('Cheapest 4hr and 30m period') || this.accessory.addService(this.platform.Service.Switch, 'Cheapest 4hr and 30m period', 'c-270')});
    switches.push({blocks: 10, accessory: this.accessory.getService('Cheapest 5hr period') || this.accessory.addService(this.platform.Service.Switch, 'Cheapest 5hr period', 'c-300')});
    switches.push({blocks: 11, accessory: this.accessory.getService('Cheapest 5hr and 30m period') || this.accessory.addService(this.platform.Service.Switch, 'Cheapest 5hr and 30m period', 'c-330')});
    switches.push({blocks: 12, accessory: this.accessory.getService('Cheapest 6hr period') || this.accessory.addService(this.platform.Service.Switch, 'Cheapest 6hr period', 'c-360')});
    switches.push({blocks: 13, accessory: this.accessory.getService('Cheapest 6hr and 30m period') || this.accessory.addService(this.platform.Service.Switch, 'Cheapest 6hr and 30m period', 'c-390')});
    switches.push({blocks: 14, accessory: this.accessory.getService('Cheapest 7hr period') || this.accessory.addService(this.platform.Service.Switch, 'Cheapest 7hr period', 'c-420')});
    switches.push({blocks: 15, accessory: this.accessory.getService('Cheapest 7hr and 30m period') || this.accessory.addService(this.platform.Service.Switch, 'Cheapest 7hr and 30m period', 'c-450')});
    switches.push({blocks: 16, accessory: this.accessory.getService('Cheapest 8hr period') || this.accessory.addService(this.platform.Service.Switch, 'Cheapest 8hr period', 'c-480')});*/

    switches.forEach(async sw => {
      sw.cheapestPeriod = await this.calculateCheapest(body, sw.blocks);
      this.platform.log.info(sw.blocks, ':', sw.cheapestPeriod.startTime.toISOString(), sw.cheapestPeriod.endTime.toISOString(), sw.cheapestPeriod.meanCost);
    });

    setInterval(() => {
      switches.forEach(async sw => {
        if(moment().isAfter(sw.cheapestPeriod.startTime) && moment().isBefore(sw.cheapestPeriod.endTime)) {
          if(!sw.state) {
            sw.accessory.updateCharacteristic(this.platform.Characteristic.On, true);
            sw.state = true;
            this.platform.log.info('Triggering switch for cheapest ' + sw.blocks * 30 + ' minute block', true);
          }
        } else {
          sw.accessory.updateCharacteristic(this.platform.Characteristic.On, false);
          sw.state = false;
        }
      });
    }, 10000);

    setInterval(async () => {
      let page: string = `https://api.octopus.energy/v1/products/AGILE-18-02-21/electricity-tariffs/E-1R-AGILE-18-02-21-L/standard-unit-rates/?period_from=${moment().hour() < 16 ? moment().subtract(1, 'day').hour(16).minute(0).toISOString() : moment().hour(16).minute(0).toISOString()}`;
      let body: any = JSON.parse((await got(page)).body);
      body = body.results;

      switches.forEach(async sw => {
        sw.cheapestPeriod = await this.calculateCheapest(body, sw.blocks);
        this.platform.log.info(sw.blocks, ':', sw.cheapestPeriod.startTime.toISOString(), sw.cheapestPeriod.endTime.toISOString(), sw.cheapestPeriod.meanCost);
      });
    }, 3600000);
  }

  async calculateCheapest(data: any[], numberOfBlocks: number) {
    let blocks: any[] = [];
    data.forEach((block, index) => {
      let output: any = {
        data: []
      };
      for(let i = index; i < index + numberOfBlocks && data.length >= index + numberOfBlocks; i++) {
        output.data.push(data[i]);
      }
      if(output.data.length === numberOfBlocks) blocks.push(output);
    });
    blocks.forEach(block => {
      block.meanCost = 0;
      block.data.forEach(timeBlock => {
        block.meanCost += timeBlock.value_inc_vat;
      });
      block.meanCost = (block.meanCost / block.data.length).toFixed(2);
      block.startTime = moment(block.data[block.data.length-1].valid_from);
      block.endTime = moment(block.data[0].valid_to);
      //delete(block.data);
    });
    blocks.sort((a, b) => {
      return a.meanCost - b.meanCost;
    });
    return blocks.length > 0 ? blocks[0] : [];
  }
}
