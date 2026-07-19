package space.aamsdn.keep_clipboard

import android.app.Activity
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

@InvokeArg
class TokenArgs {
  lateinit var token: String
}

class TokenResult {
  var token: String? = null
}

@TauriPlugin
class SecureSessionPlugin(private val activity: Activity) : Plugin(activity) {
  companion object {
    private const val KEY_ALIAS = "keep_device_session_key_v1"
    private const val PREFS_NAME = "keep_secure_session"
    private const val CIPHERTEXT = "device_token_ciphertext"
    private const val IV = "device_token_iv"
  }

  private val preferences = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private fun getOrCreateKey(): SecretKey {
    val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

    val generator = KeyGenerator.getInstance(
      KeyProperties.KEY_ALGORITHM_AES,
      "AndroidKeyStore",
    )
    generator.init(
      KeyGenParameterSpec.Builder(
        KEY_ALIAS,
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
      )
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .setRandomizedEncryptionRequired(true)
        .build(),
    )
    return generator.generateKey()
  }

  @Command
  fun getToken(invoke: Invoke) {
    try {
      val ciphertext = preferences.getString(CIPHERTEXT, null)
      val iv = preferences.getString(IV, null)
      val result = TokenResult()
      if (ciphertext != null && iv != null) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
          Cipher.DECRYPT_MODE,
          getOrCreateKey(),
          GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)),
        )
        result.token = String(
          cipher.doFinal(Base64.decode(ciphertext, Base64.NO_WRAP)),
          Charsets.UTF_8,
        )
      }
      invoke.resolveObject(result)
    } catch (error: Exception) {
      invoke.reject("Android secure session could not be read", error)
    }
  }

  @Command
  fun setToken(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(TokenArgs::class.java)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
      val ciphertext = cipher.doFinal(args.token.toByteArray(Charsets.UTF_8))
      val saved = preferences.edit()
        .putString(CIPHERTEXT, Base64.encodeToString(ciphertext, Base64.NO_WRAP))
        .putString(IV, Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
        .commit()
      if (!saved) {
        invoke.reject("Android secure session could not be saved")
        return
      }
      invoke.resolve()
    } catch (error: Exception) {
      invoke.reject("Android secure session could not be saved", error)
    }
  }

  @Command
  fun deleteToken(invoke: Invoke) {
    val deleted = preferences.edit().remove(CIPHERTEXT).remove(IV).commit()
    if (deleted) invoke.resolve()
    else invoke.reject("Android secure session could not be deleted")
  }
}
