import { Service, PlatformAccessory } from 'homebridge';
import { AgileOctopusPlatform } from './platform';
import { SearchPeriod, CustomDevice } from './types/switches';
const moment = require('moment');

export class AgileOctopusAccessory {
  private service: Service;
  private switches = [] as any;
  private swNegative: any;
  private swCheapCustom: any;
  private data = {} as any;
  private customLowPriceThreshold: number = 0.00;

  private periodDefinitions = [] as SearchPeriod[];
  private customDevices = [] as CustomDevice[];

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
    const currentPrice = this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature);
    currentPrice.setProps({minStep: 0.01});

    this.periodDefinitions.push({blocks: 1, contiguous: true, id: 'c-30', title: 'Cheapest 30m period'});
    this.periodDefinitions.push({blocks: 2, contiguous: true, id: 'c-60', title: 'Cheapest 1hr period'});
    this.periodDefinitions.push({blocks: 3, contiguous: true, id: 'c-90', title: 'Cheapest 1hr and 30m period'});
    this.periodDefinitions.push({blocks: 4, contiguous: true, id: 'c-120', title: 'Cheapest 2hr period'});
    this.periodDefinitions.push({blocks: 5, contiguous: true, id: 'c-150', title: 'Cheapest 2hr and 30m period'});
    this.periodDefinitions.push({blocks: 6, contiguous: true, id: 'c-180', title: 'Cheapest 3hr period'});
    this.periodDefinitions.push({blocks: 7, contiguous: true, id: 'c-210', title: 'Cheapest 3hr and 30m period'});
    this.periodDefinitions.push({blocks: 8, contiguous: true, id: 'c-240', title: 'Cheapest 4hr period'});
    this.periodDefinitions.push({blocks: 9, contiguous: true, id: 'c-270', title: 'Cheapest 4hr and 30m period'});
    this.periodDefinitions.push({blocks: 10, contiguous: true, id: 'c-300', title: 'Cheapest 5hr period'});
    this.periodDefinitions.push({blocks: 11, contiguous: true, id: 'c-330',title: 'Cheapest 5hr and 30m period'});
    this.periodDefinitions.push({blocks: 12, contiguous: true, id: 'c-360', title: 'Cheapest 6hr period'});

    this.init();
  }

  async init() {
    if(!this.config.disableSwitches) {
      if(this.config.customDevices) {
        this.config.customDevices.forEach((customDevice: CustomDevice) => {
          this.customDevices.push(customDevice);
          const startTime = Number(customDevice.startTime?.substring(0, 2) || 0);
          const endTime = Number(customDevice.endTime?.substring(0, 2) || 0);
          this.periodDefinitions.push({blocks: Number(customDevice.hours) * 2, contiguous: customDevice.combineSlots, id: customDevice.name, title: customDevice.name, startTime: startTime, endTime: endTime});
        });
      }

      this.periodDefinitions.forEach(period => {
        this.switches.push({title: period.title, blocks: period.blocks, contiguous: period.contiguous, startTime: period.startTime, endTime: period.endTime, accessory: this.accessory.getService(period.title) || this.accessory.addService(this.platform.Service.Switch, period.title, period.id)});
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
    this.customLowPriceThreshold = (this.config.lowPriceThreshold && !Number.isNaN(this.config.lowPriceThreshold.toFixed(2)) ? this.config.lowPriceThreshold.toFixed(2) : 10.00);

    this.actuateSwitches();

    // Set switch states - 30 seconds, there are probably more efficient ways to do this..
    setInterval(async () => {
      this.actuateSwitches();
    }, 30000);

    // Refresh data - 60 mins
    setInterval(async () => {
      await this.refreshData();
    }, 3600000);
  }

  async actuateSwitches() {
    if(!this.config.disableSwitches) {
      this.switches.forEach(async sw => {
        let state = false;
        sw.cheapestPeriods.forEach(cheapestPeriod => {
          if(moment().isAfter(cheapestPeriod.startTime) && moment().isBefore(cheapestPeriod.endTime)) {
            state = true;
          }
        });

        if(state) {
          if(!sw.state) this.platform.log.info(`Triggering switch for cheapest ${sw.blocks * 30} minute block (${sw.title})`);
          sw.accessory.updateCharacteristic(this.platform.Characteristic.On, true);
          sw.state = true;
        } else {
          if(sw.state) this.platform.log.debug(`Turning off ${sw.title}, end time passed`);
          sw.accessory.updateCharacteristic(this.platform.Characteristic.On, false);
          sw.state = false;
        }
      });
    }

    let currentSlot = this.data.filter(slot => moment().isAfter(slot.startMoment) && moment().isBefore(slot.endMoment));
    if(currentSlot) {
      this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, currentSlot[0].value_inc_vat.toFixed(2));
      if(!this.config.disableSwitches) this.swNegative.updateCharacteristic(this.platform.Characteristic.On, currentSlot[0].value_inc_vat.toFixed(2) <= 0.00);
      if(!this.config.disableSwitches) this.swCheapCustom.updateCharacteristic(this.platform.Characteristic.On, currentSlot[0].value_inc_vat.toFixed(2) <= this.customLowPriceThreshold);
    }
  }

  async calculateCheapest(octopusTimeslots: any[], numberOfBlocks: number, contiguous: boolean, startTime: string | boolean = false, endTime: string | boolean = false): Promise<any[]> {
    let blocks: any[] = [];

    if(startTime || endTime) {
      const startMoment = moment().hour(startTime).minute(0).seconds(0);
      const endMoment = moment().hour(endTime).minute(0).seconds(0);

      octopusTimeslots = octopusTimeslots.filter(timeslot => {
        return(
          (timeslot.startMoment.hour() >= startMoment.hour() && timeslot.startMoment.hour() <= endMoment.hour()) &&
          (timeslot.endMoment.hour() <= endMoment.hour() && timeslot.endMoment.hour() >= startMoment.hour())
        );
      });
      octopusTimeslots.sort((a, b) => {
        // Return slots in reverse order
        return a.startMoment.isBefore(b, 'hour') ? -1 : 1;
      });
    }

    if(contiguous) {
      octopusTimeslots.forEach((_, index) => {
        let output: any = {
          octopusTimeslots: []
        };
        for(let i = index; i < index + numberOfBlocks && octopusTimeslots.length >= index + numberOfBlocks; i++) {
          output.octopusTimeslots.push(octopusTimeslots[i]);
        }
        if(output.octopusTimeslots.length === numberOfBlocks) blocks.push(output);
      });
      blocks.forEach(block => {
        block.meanCost = 0;
        block.octopusTimeslots.forEach(timeBlock => {
          block.meanCost += timeBlock.value_inc_vat;
        });
        block.meanCost = (block.meanCost / block.octopusTimeslots.length).toFixed(2);
        block.startTime = moment(block.octopusTimeslots[block.octopusTimeslots.length-1].valid_from);
        block.endTime = moment(block.octopusTimeslots[0].valid_to);
      });
      blocks.sort((a, b) => {
        return a.meanCost - b.meanCost;
      });
      return blocks.length > 0 ? [blocks[0]] : [];
    } else if(!contiguous) {
      octopusTimeslots.sort((a, b) => {
        return a.value_inc_vat - b.value_inc_vat;
      });
      const slicedOctopusTimeslots = octopusTimeslots.slice(0, numberOfBlocks);
      blocks = slicedOctopusTimeslots.map(timeslot => {
        return {
          octopusTimeslots: timeslot,
          meanCost: timeslot.value_inc_vat,
          startTime: moment(timeslot.valid_from),
          endTime: moment(timeslot.valid_to),
        }
      })
    }
    return blocks.length > 0 ? blocks : [];
  }

  async refreshData() {
    const got = require('got');
    const page: string = `https://api.octopus.energy/v1/products/AGILE-18-02-21/electricity-tariffs/E-1R-AGILE-18-02-21-${this.config.region}/standard-unit-rates/?period_from=${moment().hour() < 16 ? moment().subtract(1, 'day').hour(16).minute(0).toISOString() : moment().hour(16).minute(0).toISOString()}`;
    const body: any = JSON.parse((await got(page)).body);
    this.data = body.results;

    await this.data.forEach(slot => {
      slot.startMoment = moment(slot.valid_from);
      slot.endMoment = moment(slot.valid_to);
    });

    await this.switches.forEach(async sw => {
      sw.cheapestPeriods = await this.calculateCheapest(this.data, sw.blocks, sw.contiguous, sw.startTime, sw.endTime);
      const slotCount: number = sw.cheapestPeriods.length;
      if(slotCount > 0) {
        if(sw.contiguous) {
          this.platform.log.info(`${sw.accessory.displayName}: the cheapest ${sw.blocks * 30} minute slot is between ${sw.cheapestPeriods[0].startTime.format('DD/MM: HH:mm')} and ${sw.cheapestPeriods[0].endTime.format('HH:mm (UTC Z)')}, average cost: ${sw.cheapestPeriods[0].meanCost}`);
        } else {
          this.platform.log.info(`${sw.accessory.displayName}: the cheapest ${sw.blocks} slots are between:`);
          sw.cheapestPeriods.forEach(period => { this.platform.log.info(`${period.startTime.format('DD/MM: HH:mm')} and ${period.endTime.format('HH:mm (UTC Z)')}, cost: ${period.meanCost.toFixed(2)}p`)});
        }
      } else {
        this.platform.log.info(`${sw.accessory.displayName}: No suitable times found`);
      }
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
