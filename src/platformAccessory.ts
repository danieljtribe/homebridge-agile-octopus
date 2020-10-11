import { Service, PlatformAccessory } from 'homebridge';

import { AgileOctopusPlatform } from './platform';
const moment = require('moment');

export class AgileOctopusAccessory {
  private service: Service;
  private switches = [] as any;
  private swNegative: any;
  private swCheapCustom: any;
  private data = {} as any;

  private periodDefinitions = [] as any;

  constructor(
    private readonly platform: AgileOctopusPlatform,
    private readonly accessory: PlatformAccessory,
    private config: any
  ) {
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Octopus Energy')
      .setCharacteristic(this.platform.Characteristic.Model, 'Agile Octopus')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Agile Octopus');

    this.service = this.accessory.getService(this.platform.Service.TemperatureSensor) || this.accessory.addService(this.platform.Service.TemperatureSensor);
    this.service.setCharacteristic(this.platform.Characteristic.Name, "Current price per unit");
    var currentPrice = this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature);
    currentPrice.setProps({minStep: 0.01});

    this.periodDefinitions.push({blocks: 1, id: 'c-30', title: 'Cheapest 30m period'});
    this.periodDefinitions.push({blocks: 2, id: 'c-60', title: 'Cheapest 1hr period'});
    this.periodDefinitions.push({blocks: 3, id: 'c-90', title: 'Cheapest 1hr and 30m period'});
    this.periodDefinitions.push({blocks: 4, id: 'c-120', title: 'Cheapest 2hr period'});
    this.periodDefinitions.push({blocks: 5, id: 'c-150', title: 'Cheapest 2hr and 30m period'});
    this.periodDefinitions.push({blocks: 6, id: 'c-180', title: 'Cheapest 3hr period'});
    this.periodDefinitions.push({blocks: 7, id: 'c-210', title: 'Cheapest 3hr and 30m period'});
    this.periodDefinitions.push({blocks: 8, id: 'c-240', title: 'Cheapest 4hr period'});
    this.periodDefinitions.push({blocks: 9, id: 'c-270', title: 'Cheapest 4hr and 30m period'});
    this.periodDefinitions.push({blocks: 10, id: 'c-300', title: 'Cheapest 5hr period'});
    this.periodDefinitions.push({blocks: 11, id: 'c-330',title: 'Cheapest 5hr and 30m period'});
    this.periodDefinitions.push({blocks: 12, id: 'c-360', title: 'Cheapest 6hr period'});

    this.init();
  }

  async init() {
    if(!this.config.disableSwitches) {
      this.periodDefinitions.forEach(period => {
        this.switches.push({blocks: period.blocks, accessory: this.accessory.getService(period.title) || this.accessory.addService(this.platform.Service.Switch, period.title, period.id)});
      });
      this.swNegative = this.accessory.getService('Negative price period') || this.accessory.addService(this.platform.Service.Switch, 'Negative price period', 'n-30');
      this.swCheapCustom = this.accessory.getService('Low price period') || this.accessory.addService(this.platform.Service.Switch, 'Low price period', 'c-custom');
    } else {
      this.periodDefinitions.forEach(async period => {
        await this.deregisterService(period.title);
      });
      await this.deregisterService('Negative price period');
      await this.deregisterService('Low price period');
    }

    await this.refreshData();

    const customLowPriceThreshold = (this.config.lowPriceThreshold && this.config.lowPriceThreshold.toFixed(2) !== NaN ? this.config.lowPriceThreshold.toFixed(2) : 10.00);

    // Set switch states - 10 seconds, there are probably more efficient ways to do this..
    setInterval(async () => {
      if(!this.config.disableSwitches) {
        this.switches.forEach(async sw => {
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
      }

      let currentSlot = this.data.filter(slot => moment().isAfter(slot.startMoment) && moment().isBefore(slot.endMoment));
      if(currentSlot) {
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, currentSlot[0].value_inc_vat.toFixed(2));
        if(!this.config.disableSwitches) this.swNegative.updateCharacteristic(this.platform.Characteristic.On, currentSlot[0].value_inc_vat.toFixed(2) <= 0.00);
        if(!this.config.disableSwitches) this.swCheapCustom.updateCharacteristic(this.platform.Characteristic.On, currentSlot[0].value_inc_vat.toFixed(2) <= customLowPriceThreshold);
      }

    }, 10000);

    // Refresh data - 60 mins
    setInterval(async () => {
      await this.refreshData();
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

  async refreshData() {
    const got = require('got');
    let page: string = `https://api.octopus.energy/v1/products/AGILE-18-02-21/electricity-tariffs/E-1R-AGILE-18-02-21-${this.config.region}/standard-unit-rates/?period_from=${moment().hour() < 16 ? moment().subtract(1, 'day').hour(16).minute(0).toISOString() : moment().hour(16).minute(0).toISOString()}`;
    let body: any = JSON.parse((await got(page)).body);
    this.data = body.results;

    await this.data.forEach(slot => {
      slot.startMoment = moment(slot.valid_from);
      slot.endMoment = moment(slot.valid_to);
    });

    await this.switches.forEach(async sw => {
      sw.cheapestPeriod = await this.calculateCheapest(this.data, sw.blocks);
      this.platform.log.info(`The cheapest ${sw.blocks*30} minute slot is between ${sw.cheapestPeriod.startTime.toISOString()} and ${sw.cheapestPeriod.endTime.toISOString()}, cost: ${sw.cheapestPeriod.meanCost}`);
    });
    return;
  }

  async deregisterService(serviceName) {
    if(this.accessory.getService(serviceName)) {
      let service: any = this.accessory.getService(serviceName);
      this.accessory.removeService(service);
    }
  }
}
