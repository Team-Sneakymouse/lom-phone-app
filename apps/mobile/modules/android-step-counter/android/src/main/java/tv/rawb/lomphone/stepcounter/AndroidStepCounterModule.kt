package tv.rawb.lomphone.stepcounter

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AndroidStepCounterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AndroidStepCounter")

    AsyncFunction("isAvailableAsync") {
      val sm = sensorManager() ?: return@AsyncFunction false
      sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
    }

    AsyncFunction("getBootCountAsync") {
      val context = appContext.reactContext ?: return@AsyncFunction 0
      Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, 0)
    }

    AsyncFunction("getBootStepCountAsync") { promise: Promise ->
      val sm = sensorManager()
      if (sm == null) {
        promise.reject("ERR_NO_SENSOR_SERVICE", "Sensor service unavailable", null)
        return@AsyncFunction
      }
      val sensor = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
      if (sensor == null) {
        promise.reject("ERR_NO_SENSOR", "TYPE_STEP_COUNTER not available", null)
        return@AsyncFunction
      }

      val mainHandler = Handler(Looper.getMainLooper())
      var settled = false

      fun settle(block: () -> Unit) {
        if (settled) return
        settled = true
        block()
      }

      val listener =
        object : SensorEventListener {
          override fun onSensorChanged(event: SensorEvent) {
            sm.unregisterListener(this)
            mainHandler.removeCallbacksAndMessages(null)
            settle {
              promise.resolve(event.values[0].toDouble())
            }
          }

          override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }

      mainHandler.postDelayed(
        {
          sm.unregisterListener(listener)
          settle {
            promise.reject("ERR_TIMEOUT", "Timed out waiting for step counter", null)
          }
        },
        4000L,
      )

      val registered =
        sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)
      if (!registered) {
        mainHandler.removeCallbacksAndMessages(null)
        settle {
          promise.reject("ERR_REGISTER", "Could not register step counter listener", null)
        }
      }
    }
  }

  private fun sensorManager(): SensorManager? {
    val context = appContext.reactContext ?: return null
    return context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
  }
}
