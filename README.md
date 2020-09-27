# Agile Octopus Homebridge Plugin

Just a simple plugin to publish switches to Homebridge, which toggle on during the cheapest 30 minute, 1-hours, 1.5-hour... up to 4-hour time periods during the day. Using automations, these can be tied to drvies to switch them on during the cheapest times of the day.

## Config

Add the following to the 'platforms' section to the Homebridge config.json, set the region letter from your tariff eg the last letter of: "E-1R-AGILE-18-02-21-L"

  "platforms": [
    {
      "platform" : "AgileOctopusRates",
      "name" : "Agile Octopus Rates",
      "region": "L",
      "lowPriceThreshold": 10.0
    }
  ]

  ## Issues

  This is just thrown-together for my own use, but if others get value from this please let me via know how you're using it and if anything can be added which you might find useful for your own implementation:
  [GitHub issues](https://github.com/danieljtribe/homebridge-agile-octopus/issues/new)
