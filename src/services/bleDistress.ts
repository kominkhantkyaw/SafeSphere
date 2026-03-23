/**
 * SOS over Web Bluetooth (GATT write).
 *
 * Important: browsers require non-empty optionalServices when using acceptAllDevices,
 * otherwise connected devices may expose no writable services. Consumer TVs and phones
 * rarely expose a writable BLE characteristic — use a dedicated responder dongle / app
 * that implements one of the service UUIDs below.
 */

export interface SosBlePayload {
    lat: number;
    lng: number;
    timestamp: number;
    userHint?: string;
}

export interface SosBleSendResult {
    ok: boolean;
    message: string;
}

/** SafeSphere responder service (custom) — implement on companion firmware / native app. */
export const SAFESPHERE_SOS_SERVICE_UUID = '8d3414dd-db2b-45ee-8e9c-7fb8b0f5c459';
export const SAFESPHERE_SOS_WRITE_CHAR_UUID = '8d3414de-db2b-45ee-8e9c-7fb8b0f5c459';

/** Nordic UART Service — common on ESP32 / nRF BLE serial bridges. */
const NUS_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_RX_CHAR_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

const OPTIONAL_SERVICES: BluetoothServiceUUID[] = [
    SAFESPHERE_SOS_SERVICE_UUID,
    NUS_SERVICE_UUID,
];

function isWebBluetoothAvailable(): boolean {
    return typeof navigator !== 'undefined' && !!(navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth;
}

/** Compact binary packet (≤20 bytes) for small ATT payloads. */
function encodeCompactPacket(payload: SosBlePayload): Uint8Array {
    const buf = new ArrayBuffer(15);
    const d = new DataView(buf);
    d.setUint8(0, 0x53); // 'S'
    d.setUint8(1, 0x53); // 'S'
    d.setUint8(2, 0x01); // v1
    d.setInt32(3, Math.round(payload.lat * 1e6), true);
    d.setInt32(7, Math.round(payload.lng * 1e6), true);
    d.setUint32(11, Math.floor(payload.timestamp / 1000), true);
    return new Uint8Array(buf);
}

function encodeJsonPayload(payload: SosBlePayload): Uint8Array {
    const json = JSON.stringify({
        type: 'safesphere_sos',
        lat: payload.lat,
        lng: payload.lng,
        timestamp: payload.timestamp,
        ...(payload.userHint ? { hint: payload.userHint } : {}),
    });
    return new TextEncoder().encode(json);
}

async function writeChunks(
    ch: BluetoothRemoteGATTCharacteristic,
    data: Uint8Array
): Promise<void> {
    const props = ch.properties;
    const chunkSize = 20;
    for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.subarray(i, i + chunkSize);
        if (props.writeWithoutResponse && typeof ch.writeValueWithoutResponse === 'function') {
            await ch.writeValueWithoutResponse(chunk);
        } else if (props.write && typeof ch.writeValue === 'function') {
            await ch.writeValue(chunk);
        } else {
            throw new Error('Characteristic is not writable');
        }
    }
}

async function tryWriteToCharacteristic(
    ch: BluetoothRemoteGATTCharacteristic,
    data: Uint8Array
): Promise<boolean> {
    const props = ch.properties;
    const canWrite = !!(props.write || props.writeWithoutResponse);
    if (!canWrite) return false;
    await writeChunks(ch, data);
    return true;
}

async function trySafeSphereService(server: BluetoothRemoteGATTServer, packet: Uint8Array): Promise<boolean> {
    try {
        const svc = await server.getPrimaryService(SAFESPHERE_SOS_SERVICE_UUID);
        const ch = await svc.getCharacteristic(SAFESPHERE_SOS_WRITE_CHAR_UUID);
        return await tryWriteToCharacteristic(ch, packet);
    } catch {
        return false;
    }
}

async function tryNordicUart(server: BluetoothRemoteGATTServer, packet: Uint8Array, json: Uint8Array): Promise<boolean> {
    try {
        const svc = await server.getPrimaryService(NUS_SERVICE_UUID);
        const ch = await svc.getCharacteristic(NUS_RX_CHAR_UUID);
        if (await tryWriteToCharacteristic(ch, packet)) return true;
        return await tryWriteToCharacteristic(ch, json);
    } catch {
        return false;
    }
}

async function tryAnyWritableCharacteristic(server: BluetoothRemoteGATTServer, json: Uint8Array): Promise<boolean> {
    let services: BluetoothRemoteGATTService[];
    try {
        services = await server.getPrimaryServices();
    } catch {
        return false;
    }
    for (const service of services) {
        let characteristics: BluetoothRemoteGATTCharacteristic[];
        try {
            characteristics = await service.getCharacteristics();
        } catch {
            continue;
        }
        for (const ch of characteristics) {
            try {
                if (await tryWriteToCharacteristic(ch, json)) return true;
            } catch {
                continue;
            }
        }
    }
    return false;
}

/**
 * Pick a BLE device and send SOS data.
 * Prefers devices that advertise SafeSphere or Nordic UART; falls back to “all devices”.
 */
export async function sendSosViaBluetooth(payload: SosBlePayload): Promise<SosBleSendResult> {
    if (!isWebBluetoothAvailable()) {
        return { ok: false, message: 'Web Bluetooth is not available in this browser/context.' };
    }

    const bluetooth = (navigator as Navigator & { bluetooth: Bluetooth }).bluetooth;
    const compact = encodeCompactPacket(payload);
    const json = encodeJsonPayload(payload);

    let device: BluetoothDevice;
    try {
        // Non-empty optionalServices is required with acceptAllDevices or Chrome may not expose GATT services.
        device = await bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: OPTIONAL_SERVICES,
        });
    } catch (err) {
        if (err instanceof DOMException && err.name === 'NotFoundError') {
            return {
                ok: false,
                message: 'No Bluetooth device selected. Choose a dedicated responder receiver if you have one.',
            };
        }
        if (err instanceof DOMException && err.name === 'SecurityError') {
            return { ok: false, message: 'Bluetooth blocked — use HTTPS and allow the permission prompt.' };
        }
        return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }

    if (!device.gatt) {
        return { ok: false, message: 'Device does not support GATT (not usable for SOS data).' };
    }

    try {
        const server = await device.gatt.connect();

        if (await trySafeSphereService(server, compact)) {
            try {
                server.disconnect();
            } catch {
                /* ignore */
            }
            return { ok: true, message: 'SOS sent to SafeSphere responder service.' };
        }

        if (await tryNordicUart(server, compact, json)) {
            try {
                server.disconnect();
            } catch {
                /* ignore */
            }
            return { ok: true, message: 'SOS sent via Nordic UART (BLE serial).' };
        }

        if (await tryAnyWritableCharacteristic(server, json)) {
            try {
                server.disconnect();
            } catch {
                /* ignore */
            }
            return { ok: true, message: 'SOS payload written to a BLE characteristic.' };
        }

        try {
            server.disconnect();
        } catch {
            /* ignore */
        }

        return {
            ok: false,
            message:
                'This device has no writable BLE channel SafeSphere can use. Pair a dedicated responder dongle or app that advertises SafeSphere SOS or Nordic UART — not a TV or car stereo.',
        };
    } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
}
