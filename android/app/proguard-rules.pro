# SPDX-License-Identifier: MIT

# Keep DTOs (kotlinx-serialization)
-keepattributes *Annotation*,InnerClasses
-keepclassmembers class org.chirag.jalsakhi.data.remote.dto.** { *; }
-keep,includedescriptorclasses class org.chirag.jalsakhi.**$$serializer { *; }
-keepclassmembers class org.chirag.jalsakhi.** {
    *** Companion;
}

# Room
-keep class androidx.room.** { *; }
-keepclassmembers class * extends androidx.room.RoomDatabase {
    public static <methods>;
}

# Apache POI — strip out unused chart/draw/SXSSF code paths in release.
-dontwarn org.apache.poi.**
-dontwarn org.openxmlformats.**
-dontwarn org.bouncycastle.**
-dontwarn org.etsi.uri.**
-dontwarn org.w3.x2000.**
-dontwarn schemasMicrosoftCom**
-dontwarn com.microsoft.schemas.**
-keep class org.apache.poi.xssf.usermodel.** { *; }

# WorkManager & coroutines — leave to default rules.
