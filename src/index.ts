import prompts from "prompts"
import {
  green,
} from 'kolorist'
import fs from 'node:fs'
import path from 'node:path'
import spawn from "spawn-please"
import glob from 'glob'

const toRead = `
# Before starting

## To send an IPA file to a connected mobile device from a Mac with an M1 chip, you can use the cfgutil command-line tool which is maintain by apple

- Download "Apple Configurator 2" app from apple app store
- Your device must be registered in your Apple Developer account and properly provisioned.
- Install Apple Configurator 2
- Enable Command Line Tools for Apple Configurator 2, Open Apple Configurator 2, In the menu bar, go to "Apple Configurator 2" > "Install Automation Tools..."
- Follow the prompts to install the command-line tools.
- Connect your iOS device to your Mac using a USB cable.
- If prompted on your iOS device, choose to trust the computer.

type y and enter if you have done the above steps
`

const commands = {
  listDevices: async () => {
    const { stdout } = await spawn('cfgutil', ["list"])
    const devices = stdout.split('\n').filter((device) => device.trim() !== '')
    return devices;
  },
  getECID: (device_string: string) => {
    const d_split = device_string.replaceAll("\t", " ").split(" ")
    const index = d_split.findIndex((d) => d.includes('ECID'));
    if (index === -1) {
      throw new Error('ECID not found')
    }
    return d_split[index + 1]
  },
  deployToIos: async (ipaPath: string, device: string) => {
    const { stdout } = await spawn(
        "cfgutil", [
          "--ecid",
          device,
          "install-app",
          ipaPath
    ])
    return stdout
  }
}

const logs = {
  valid: (message:string) => console.log(`${green('[x]')} ${message}`),
}

async function init() {

  const cwd = process.cwd()
  const tauriFolder = path.join(cwd, 'src-tauri')
  const tauriConfigPath = path.join(cwd, 'src-tauri/tauri.conf.json')
  const { listDevices, getECID, deployToIos } = commands
  let iosGenPath = path.join(cwd, 'src-tauri/gen/apple/build')

  const { value } = await prompts({
    type: "confirm",
    name: 'value',
    message: toRead
  })

  if (!value) return

  if (!fs.existsSync(tauriConfigPath)) throw new Error('tauri.conf.json not found')

  logs.valid('tauri.conf.json found')

  const { productName } = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf-8'))

  if (!productName) throw new Error('product name not found')

  logs.valid(`productName found: ${productName}`)

  const files = glob.sync(`${iosGenPath}/**/*.ipa`)

  if (files.length === 0) throw new Error('iOS IPA build not found')

  const ipaPathSelect = await prompts({
    type: 'select',
    name: 'value',
    message: 'Select the IPA file to deploy',
    choices: files.map((file) => {
      return {
        title: file,
        value: file
      }
    })
  })

  const devices = await listDevices()

  if (devices.length === 0) throw new Error('No devices found')

  const deviceSelected = await prompts({
    type: 'select',
    name: 'value',
    message: 'Select a device to deploy the IPA',
    choices: devices.map((device) => {
      return {
        title: device,
        value: device
      }
    })
  })

  logs.valid("Make sure your mobile phone is connected and ready to receive the IPA")

  const device_id = commands.getECID(deviceSelected.value)

  console.log(await commands.deployToIos(ipaPathSelect.value, device_id))

  logs.valid("IPA deployed to your device")
}


init().catch((e) => {
  console.error(e)
  process.exit(1)
})
