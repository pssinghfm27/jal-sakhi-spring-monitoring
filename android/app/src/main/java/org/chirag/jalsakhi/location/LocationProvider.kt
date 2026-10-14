// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationResult

class LocationProvider(ctx: Context) {
    private val client = LocationServices.getFusedLocationProviderClient(ctx)

    @SuppressLint("MissingPermission")
    fun stream(): Flow<Location> = callbackFlow {
        val req = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 2000L)
            .setMinUpdateIntervalMillis(1000L)
            .setMaxUpdateDelayMillis(4000L)
            .build()
        val cb = object : LocationCallback() {
            override fun onLocationResult(r: LocationResult) {
                r.lastLocation?.let { trySend(it) }
            }
        }
        client.requestLocationUpdates(req, cb, android.os.Looper.getMainLooper())
        awaitClose { client.removeLocationUpdates(cb) }
    }
}
