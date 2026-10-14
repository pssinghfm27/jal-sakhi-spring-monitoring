// SPDX-License-Identifier: MIT
package org.chirag.jalsakhi.ui.nav

import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.NavType
import androidx.navigation.navArgument
import org.chirag.jalsakhi.JalSakhiApp
import org.chirag.jalsakhi.ui.screens.discharge.NewDischargeScreen
import org.chirag.jalsakhi.ui.screens.home.HomeScreen
import org.chirag.jalsakhi.ui.screens.login.LoginScreen
import org.chirag.jalsakhi.ui.screens.quality.NewQualityScreen
import org.chirag.jalsakhi.ui.screens.reminders.RemindersScreen
import org.chirag.jalsakhi.ui.screens.setup.ServerSetupScreen
import org.chirag.jalsakhi.ui.screens.signup.PendingApprovalScreen
import org.chirag.jalsakhi.ui.screens.signup.SignupScreen
import org.chirag.jalsakhi.ui.screens.springs.MySpringsScreen
import org.chirag.jalsakhi.ui.screens.sync.SyncStatusScreen

object Routes {
    const val Setup = "setup"
    const val Login = "login"
    const val Signup = "signup"
    const val Pending = "pending/{msg}"
    const val Home = "home"
    const val Discharge = "discharge"
    const val Quality = "quality"
    const val Springs = "springs"
    const val Sync = "sync"
    const val Reminders = "reminders"

    fun pending(msg: String) = "pending/${Uri.encode(msg)}"
}

@Composable
fun AppNav() {
    val nav = rememberNavController()
    val store = JalSakhiApp.instance.authStore
    val start = remember {
        when {
            !store.hasServerUrl -> Routes.Setup
            store.isLoggedIn    -> Routes.Home
            else                -> Routes.Login
        }
    }
    NavHost(navController = nav, startDestination = start) {

        composable(Routes.Setup) {
            ServerSetupScreen(onDone = {
                nav.navigate(Routes.Login) { popUpTo(Routes.Setup) { inclusive = true } }
            })
        }

        composable(Routes.Login) {
            LoginScreen(
                onLoggedIn = {
                    nav.navigate(Routes.Home) { popUpTo(Routes.Login) { inclusive = true } }
                },
                onSignup = { nav.navigate(Routes.Signup) },
                onPending = { msg ->
                    nav.navigate(Routes.pending(msg)) { popUpTo(Routes.Login) { inclusive = false } }
                },
                onChangeServer = { nav.navigate(Routes.Setup) },
            )
        }

        composable(Routes.Signup) {
            SignupScreen(
                onDone = { msg ->
                    nav.navigate(Routes.pending(msg)) {
                        popUpTo(Routes.Login) { inclusive = false }
                    }
                },
                onBack = { nav.popBackStack() },
            )
        }

        composable(
            route = Routes.Pending,
            arguments = listOf(navArgument("msg") { type = NavType.StringType }),
        ) { entry ->
            val msg = entry.arguments?.getString("msg") ?: ""
            PendingApprovalScreen(
                message = msg,
                onBackToLogin = {
                    nav.navigate(Routes.Login) { popUpTo(Routes.Login) { inclusive = true } }
                },
            )
        }

        composable(Routes.Home) {
            HomeScreen(
                onDischarge = { nav.navigate(Routes.Discharge) },
                onQuality = { nav.navigate(Routes.Quality) },
                onSprings = { nav.navigate(Routes.Springs) },
                onSync = { nav.navigate(Routes.Sync) },
                onReminders = { nav.navigate(Routes.Reminders) },
                onLogout = {
                    JalSakhiApp.instance.authRepo.logout()
                    nav.navigate(Routes.Login) { popUpTo(Routes.Home) { inclusive = true } }
                },
            )
        }
        composable(Routes.Discharge)  { NewDischargeScreen(onDone = { nav.popBackStack() }) }
        composable(Routes.Quality)    { NewQualityScreen(onDone = { nav.popBackStack() }) }
        composable(Routes.Springs)    { MySpringsScreen(onBack = { nav.popBackStack() }) }
        composable(Routes.Sync)       { SyncStatusScreen(onBack = { nav.popBackStack() }) }
        composable(Routes.Reminders)  { RemindersScreen(onBack = { nav.popBackStack() }) }
    }
}
