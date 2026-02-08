package com.trenztechnologies

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.IOException
import java.io.OutputStream
import java.util.*

class XprinterModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bluetoothSocket: BluetoothSocket? = null
    private var outputStream: OutputStream? = null
    
    private val printBuffer = StringBuilder()
    
    // SPP UUID for Bluetooth serial communication
    private val SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    
    init {
        bluetoothAdapter = BluetoothAdapter.getDefaultAdapter()
    }
    
    override fun getName(): String {
        return "XprinterModule"
    }
    
    /**
     * Open system Bluetooth settings so user can turn on BT and pair the printer.
     */
    @ReactMethod
    fun openBluetoothSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_BLUETOOTH_SETTINGS).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
            reactApplicationContext.currentActivity?.startActivity(intent)
                ?: reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", "Could not open Bluetooth settings: ${e.message}", e)
        }
    }

    /**
     * Get list of paired Bluetooth devices
     */
    @ReactMethod
    fun getPairedDevices(promise: Promise) {
        try {
            if (bluetoothAdapter == null) {
                promise.reject("NO_BLUETOOTH", "Bluetooth adapter not available")
                return
            }
            
            if (!bluetoothAdapter!!.isEnabled) {
                promise.reject("BLUETOOTH_DISABLED", "Bluetooth is not enabled")
                return
            }
            
            val pairedDevices: Set<BluetoothDevice> = bluetoothAdapter!!.bondedDevices
            val deviceList = WritableNativeArray()
            
            for (device in pairedDevices) {
                val deviceMap = WritableNativeMap()
                deviceMap.putString("name", device.name)
                deviceMap.putString("address", device.address)
                deviceList.pushMap(deviceMap)
            }
            
            promise.resolve(deviceList)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to get paired devices: ${e.message}", e)
        }
    }
    
    /**
     * Connect to Bluetooth printer by MAC address
     */
    @ReactMethod
    fun connectBluetooth(macAddress: String, promise: Promise) {
        try {
            if (bluetoothAdapter == null) {
                promise.reject("NO_BLUETOOTH", "Bluetooth adapter not available")
                return
            }
            
            if (!bluetoothAdapter!!.isEnabled) {
                promise.reject("BLUETOOTH_DISABLED", "Bluetooth is not enabled")
                return
            }
            
            // Disconnect existing connection if any
            disconnect()
            
            val device = bluetoothAdapter!!.getRemoteDevice(macAddress)
            
            // Connect in background thread to avoid blocking
            Thread {
                try {
                    // Try standard SPP connection first
                    bluetoothSocket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                    try {
                        bluetoothSocket!!.connect()
                    } catch (e: IOException) {
                        // Fallback: many Xprinter/XP-v320m need this reflection fallback
                        bluetoothSocket?.close()
                        val method = device.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType)
                        bluetoothSocket = method.invoke(device, 1) as BluetoothSocket
                        bluetoothSocket!!.connect()
                    }
                    outputStream = bluetoothSocket!!.outputStream
                    
                    reactApplicationContext.runOnUiQueueThread {
                        promise.resolve(true)
                    }
                } catch (e: IOException) {
                    reactApplicationContext.runOnUiQueueThread {
                        promise.reject("CONNECTION_FAILED", "Failed to connect: ${e.message}. Ensure printer is on and paired in Bluetooth settings.", e)
                    }
                } catch (e: Exception) {
                    reactApplicationContext.runOnUiQueueThread {
                        promise.reject("CONNECTION_FAILED", "Failed to connect: ${e.message}", e)
                    }
                }
            }.start()
            
        } catch (e: Exception) {
            promise.reject("ERROR", "Connection error: ${e.message}", e)
        }
    }
    
    /**
     * Check if connected to printer
     */
    @ReactMethod
    fun isConnected(promise: Promise) {
        val connected = bluetoothSocket != null && 
                       bluetoothSocket!!.isConnected && 
                       outputStream != null
        promise.resolve(connected)
    }
    
    /**
     * Encoding as per official Xprinter Example4Bluetooth: GBK.
     * Send in small chunks so printer buffer never overflows (avoids "only title + bottom" print).
     */
    private val BT_WRITE_CHUNK = 64
    private val BT_WRITE_DELAY_MS = 80L

    @ReactMethod
    fun printBillStart(promise: Promise) {
        printBuffer.setLength(0)
        promise.resolve(true)
    }

    @ReactMethod
    fun printBillChunk(text: String, promise: Promise) {
        printBuffer.append(text)
        promise.resolve(true)
    }

    @ReactMethod
    fun printBillFlush(promise: Promise) {
        if (outputStream == null || bluetoothSocket == null || !bluetoothSocket!!.isConnected) {
            promise.reject("NOT_CONNECTED", "Printer is not connected")
            return
        }
        val full = printBuffer.toString()
        printBuffer.setLength(0)
        // JS sends ASCII-only (toAscii); use ASCII so no encoding garbage / random chars
        val data = full.toByteArray(Charsets.US_ASCII)
        Thread {
            try {
                var offset = 0
                while (offset < data.size) {
                    val end = minOf(offset + BT_WRITE_CHUNK, data.size)
                    outputStream!!.write(data, offset, end - offset)
                    outputStream!!.flush()
                    offset = end
                    if (offset < data.size) Thread.sleep(BT_WRITE_DELAY_MS)
                }
                reactApplicationContext.runOnUiQueueThread { promise.resolve(true) }
            } catch (e: Exception) {
                reactApplicationContext.runOnUiQueueThread {
                    promise.reject("PRINT_ERROR", "Failed to print: ${e.message}", e)
                }
            }
        }.start()
    }

    @ReactMethod
    fun printText(text: String, promise: Promise) {
        try {
            if (outputStream == null || bluetoothSocket == null || !bluetoothSocket!!.isConnected) {
                promise.reject("NOT_CONNECTED", "Printer is not connected")
                return
            }
            val data = text.toByteArray(Charsets.US_ASCII)
            outputStream!!.write(data)
            outputStream!!.flush()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PRINT_ERROR", "Failed to print: ${e.message}", e)
        }
    }

    /**
     * Print raw bytes (for ESC/POS commands)
     */
    @ReactMethod
    fun printRawBytes(bytes: ReadableArray, promise: Promise) {
        try {
            if (outputStream == null || bluetoothSocket == null || !bluetoothSocket!!.isConnected) {
                promise.reject("NOT_CONNECTED", "Printer is not connected")
                return
            }
            
            val byteArray = ByteArray(bytes.size())
            for (i in 0 until bytes.size()) {
                byteArray[i] = bytes.getInt(i).toByte()
            }
            
            outputStream!!.write(byteArray)
            outputStream!!.flush()
            
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PRINT_ERROR", "Failed to print raw bytes: ${e.message}", e)
        }
    }
    
    /**
     * Open cash drawer
     */
    @ReactMethod
    fun openCashDrawer(promise: Promise) {
        try {
            if (outputStream == null || bluetoothSocket == null || !bluetoothSocket!!.isConnected) {
                promise.reject("NOT_CONNECTED", "Printer is not connected")
                return
            }
            
            // ESC/POS command to open cash drawer
            val command = byteArrayOf(0x1b, 0x70, 0x00, 0x1e, 0xff.toByte(), 0x00)
            outputStream!!.write(command)
            outputStream!!.flush()
            
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CASH_DRAWER_ERROR", "Failed to open cash drawer: ${e.message}", e)
        }
    }
    
    /**
     * Cut paper
     */
    @ReactMethod
    fun cutPaper(promise: Promise) {
        try {
            if (outputStream == null || bluetoothSocket == null || !bluetoothSocket!!.isConnected) {
                promise.reject("NOT_CONNECTED", "Printer is not connected")
                return
            }
            
            // ESC/POS command to cut paper
            val command = byteArrayOf(0x0a, 0x0a, 0x1d, 0x56, 0x01)
            outputStream!!.write(command)
            outputStream!!.flush()
            
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CUT_ERROR", "Failed to cut paper: ${e.message}", e)
        }
    }
    
    /**
     * Disconnect from printer. Promise is optional when called internally (e.g. before reconnect or on destroy).
     */
    @ReactMethod
    fun disconnect(promise: Promise? = null) {
        try {
            outputStream?.close()
            bluetoothSocket?.close()
            outputStream = null
            bluetoothSocket = null
            promise?.resolve(true)
        } catch (e: Exception) {
            promise?.reject("DISCONNECT_ERROR", "Failed to disconnect: ${e.message}", e)
        }
    }
    
    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        disconnect()
    }
}

