# Agile Octopus Homebridge Plugin

Just a simple plugin to publish switches to Homebridge, which toggle on during the cheapest 30 minute, 1-hours, 1.5-hour... up to 4-hour time periods during the day. Using automations, these can be tied to devices to switch them on during the cheapest times of the day.

## Config

Add the following to the 'platforms' section to the Homebridge config.json, set the region letter from your tariff eg the last letter ('L') of: "E-1R-AGILE-18-02-21-__L__"

  ```"platforms":
  [
    {
      "platform" : "AgileOctopusRates",
      "name" : "Agile Octopus Rates",
      "region": "L",
      "lowPriceThreshold": 10.0
    }
  ]
  ```

  ## Custom devices

  From version 1.2.0 Custom Device support has been added. 
  To configure a custom device which doesn't fit within the standard set of outputs from this plugin, either using the config UI or within your config.json add a customDevices block within the plugin configuration:

  ``` "customDevices": [
        {
            "name": "Cheapest Afternoon Hour",
            "hours": "1.0",
            "startTime": "15:00",
            "endTime": "16:00",
            "combineSlots": true
        }
    ]
```

  - **hours**: In decimal format (eg. 1.5), the length of time the custom device needs power.
  - **startTime** & **endTime**: String (eg. 12:00) The earliest and latest time a custom device can be activated.  
  - **combineSlots**: Boolean (eg. true/false) 
    - When "true" finds the cheapest contiguous time blocks to activate the custom device, suitable for devices which require power continually - for example a washing machine. 
    - Or when "false" the plugin may switch a device on during non-contiguous time slots in order to find the cheapest number of half-hour blocks which fit between the start and end times, suitable for devices which can adapt to being switched on or off during the time window specified - for example a hot water immersion heater.

  ## Issues

  This plugin has been built around my own use and the suggestions of others, all feature requests and suggestions are greatly welcomed and will be incorporated if feasible. Please also raise any issues via the GitHub issues page if you notice any: [GitHub issues](https://github.com/danieljtribe/homebridge-agile-octopus/issues/new)

  ## Donations
  Donations are greatly welcomed and help me to continue working on project like this: https://ko-fi.com/a113daniel
