export interface SosBlePayload {
    lat: number;
    lng: number;
    timestamp: number;
    // Optional extra fields for future responder firmware compatibility.
    userHint?: string;
}

export interface SosBleSendResult {
    ok: boolean;
    message: string;
}

function isWebBluetoothAvailable(): boolean {
    return typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;
}

function encodePayload(payload: SosBlePayload): Uint8Array {
    // Many embedded responder receivers can parse JSON. We keep this simple and text-based.
    const json = JSON.stringify({ type: 'safesphere_sos', ...payload });
    return new TextEncoder().encode(json);
}

/** Best-effort SOS sender via Web Bluetooth.
 *  - Requires a responder-side BLE GATT server that exposes at least one writable characteristic.
 *  - If the UUIDs are unknown, we dynamically pick the first characteristic that supports `write` or `writeWithoutResponse`. */
export async function sendSosViaBluetooth(payload: SosBlePayload): Promise<SosBleSendResult> {
    if (!isWebBluetoothAvailable()) {
        return { ok: false, message: 'Web Bluetooth is not available in this browser/context.' };
    }

    try {
        // Secure-context + user gesture required by Web Bluetooth.
        const device = await (navigator as any).bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: []
        });

        if (!device.gatt) {
            return { ok: false, message: 'Device does not support GATT.' };
        }

        const server = await device.gatt.connect();
        const services = await server.getPrimaryServices();

        const data = encodePayload(payload);

        for (const service of services) {
            const characteristics = await service.getCharacteristics();
            for (const ch of characteristics) {
                const props = ch.properties || {};
                const canWrite =
                    !!props.write ||
                    !!props.writeWithoutResponse;

                if (!canWrite) continue;

                // Prefer writeWithoutResponse when available to reduce UI latency.
                if (!!props.writeWithoutResponse && typeof ch.writeValueWithoutResponse === 'function') {
                    await ch.writeValueWithoutResponse(data);
                } else if (!!props.write && typeof ch.writeValue === 'function') {
                    await ch.writeValue(data);
                } else {
                    continue;
                }

                // Clean disconnect to free resources.
                try {
                    server.disconnect();
                } catch { /* ignore */ }

                return { ok: true, message: 'SOS signal sent via BLE.' };
            }
        }

        try {
            server.disconnect();
        } catch { /* ignore */ }

        return {
            ok: false,
            message: 'Connected device has no writable BLE characteristic compatible with SOS payload.'
        };
    } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
}

