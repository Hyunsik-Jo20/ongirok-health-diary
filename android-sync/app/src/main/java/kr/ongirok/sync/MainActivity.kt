package kr.ongirok.sync

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.time.Duration
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import kotlin.math.round

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    SyncApp()
                }
            }
        }
    }
}

private val permissions = setOf(
    HealthPermission.getReadPermission(StepsRecord::class),
    HealthPermission.getReadPermission(DistanceRecord::class),
    HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
    HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
    HealthPermission.getReadPermission(ExerciseSessionRecord::class),
    HealthPermission.getReadPermission(HeartRateRecord::class),
    HealthPermission.getReadPermission(RestingHeartRateRecord::class),
    HealthPermission.getReadPermission(SleepSessionRecord::class),
    HealthPermission.getReadPermission(OxygenSaturationRecord::class)
)

@Composable
fun SyncApp() {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var accessToken by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("온기록 계정으로 로그인한 뒤 Health Connect 권한을 허용하세요.") }
    var healthClient by remember { mutableStateOf<HealthConnectClient?>(null) }
    var permissionsGranted by remember { mutableStateOf(false) }
    val configStatus = remember {
        val hasUrl = BuildConfig.SUPABASE_URL.startsWith("https://")
        val hasKey = BuildConfig.SUPABASE_ANON_KEY.length > 20
        when {
            hasUrl && hasKey -> "Supabase 설정 확인됨"
            !hasUrl && !hasKey -> "Supabase URL과 anon key가 없습니다."
            !hasUrl -> "Supabase URL이 없습니다."
            else -> "Supabase anon key가 없습니다."
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted ->
        permissionsGranted = granted.containsAll(permissions)
        status = if (permissionsGranted) {
            "Health Connect 권한이 허용되었습니다."
        } else {
            "일부 권한이 허용되지 않았습니다."
        }
    }

    LaunchedEffect(Unit) {
        healthClient = runCatching { HealthConnectClient.getOrCreate(context) }.getOrNull()
        if (healthClient == null) {
            status = "Health Connect를 사용할 수 없습니다. 기기에 Health Connect를 설치하거나 업데이트하세요."
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("온기록 Sync", style = MaterialTheme.typography.headlineMedium)
        Text("Health Connect의 걸음·운동·심박·수면 데이터를 온기록에 보냅니다.")

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("상태", style = MaterialTheme.typography.titleMedium)
                Text(status)
                Text(configStatus, style = MaterialTheme.typography.bodySmall)
            }
        }

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("온기록 이메일") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("비밀번호") },
                    visualTransformation = PasswordVisualTransformation(),
                    modifier = Modifier.fillMaxWidth()
                )
                Button(
                    onClick = {
                        scope.launch {
                            if (email.isBlank() || password.isBlank()) {
                                status = "이메일과 비밀번호를 모두 입력하세요."
                                return@launch
                            }
                            status = "로그인 중..."
                            runCatching { signIn(email.trim(), password) }
                                .onSuccess {
                                    accessToken = it
                                    status = "로그인 완료. Health Connect 권한을 허용하세요."
                                }
                                .onFailure { status = "로그인 실패: ${it.message}" }
                        }
                    }
                ) { Text("로그인") }
                Button(
                    onClick = {
                        scope.launch {
                            if (email.isBlank()) {
                                status = "비밀번호 재설정 메일을 받을 이메일을 입력하세요."
                                return@launch
                            }
                            status = "비밀번호 재설정 메일 전송 중..."
                            runCatching { sendPasswordReset(email.trim()) }
                                .onSuccess { status = "비밀번호 재설정 메일을 보냈습니다. 메일에서 새 비밀번호를 설정한 뒤 다시 로그인하세요." }
                                .onFailure { status = "재설정 메일 전송 실패: ${it.message}" }
                        }
                    }
                ) { Text("비밀번호 재설정 메일 받기") }
            }
        }

        Button(
            onClick = { permissionLauncher.launch(permissions) },
            enabled = healthClient != null
        ) { Text("Health Connect 권한 허용") }

        Button(
            onClick = {
                scope.launch {
                    val client = healthClient ?: return@launch
                    status = "오늘 데이터 동기화 중..."
                    runCatching { syncDate(client, accessToken, LocalDate.now()) }
                        .onSuccess { status = "오늘 데이터 동기화 완료" }
                        .onFailure { status = "동기화 실패: ${it.message}" }
                }
            },
            enabled = accessToken.isNotBlank() && permissionsGranted
        ) { Text("오늘 동기화") }

        Button(
            onClick = {
                scope.launch {
                    val client = healthClient ?: return@launch
                    status = "최근 7일 동기화 중..."
                    runCatching {
                        (0..6).forEach { offset ->
                            syncDate(client, accessToken, LocalDate.now().minusDays(offset.toLong()))
                        }
                    }.onSuccess {
                        status = "최근 7일 동기화 완료"
                    }.onFailure {
                        status = "동기화 실패: ${it.message}"
                    }
                }
            },
            enabled = accessToken.isNotBlank() && permissionsGranted
        ) { Text("최근 7일 동기화") }
    }
}

private suspend fun signIn(email: String, password: String): String = withContext(Dispatchers.IO) {
    val supabaseUrl = BuildConfig.SUPABASE_URL.trimEnd('/')
    val anonKey = BuildConfig.SUPABASE_ANON_KEY
    require(supabaseUrl.startsWith("https://") && anonKey.length > 20) {
        "local.properties에 SUPABASE_URL과 SUPABASE_ANON_KEY(anon public)를 입력하세요."
    }

    val connection = (URL("$supabaseUrl/auth/v1/token?grant_type=password").openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("apikey", anonKey)
        setRequestProperty("Authorization", "Bearer $anonKey")
        doOutput = true
    }
    val payload = buildJsonObject {
        put("email", email)
        put("password", password)
    }.toString()
    OutputStreamWriter(connection.outputStream).use { it.write(payload) }
    val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
    val text = stream?.bufferedReader()?.readText().orEmpty()
    if (connection.responseCode !in 200..299) {
        val message = runCatching {
            val json = Json.parseToJsonElement(text).jsonObject
            json["msg"]?.jsonPrimitive?.content
                ?: json["message"]?.jsonPrimitive?.content
                ?: json["error_description"]?.jsonPrimitive?.content
                ?: json["error"]?.jsonPrimitive?.content
        }.getOrNull()
        error(message ?: "Supabase 로그인 실패 ${connection.responseCode}: $text")
    }
    return@withContext Json.parseToJsonElement(text).jsonObject["access_token"]?.jsonPrimitive?.content
        ?: error("Supabase 응답에 access_token이 없습니다.")
}

private suspend fun sendPasswordReset(email: String) = withContext(Dispatchers.IO) {
    val supabaseUrl = BuildConfig.SUPABASE_URL.trimEnd('/')
    val anonKey = BuildConfig.SUPABASE_ANON_KEY
    require(supabaseUrl.startsWith("https://") && anonKey.length > 20) {
        "local.properties에 SUPABASE_URL과 SUPABASE_ANON_KEY(anon public)를 입력하세요."
    }
    val connection = (URL("$supabaseUrl/auth/v1/recover").openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("apikey", anonKey)
        setRequestProperty("Authorization", "Bearer $anonKey")
        doOutput = true
    }
    val payload = buildJsonObject {
        put("email", email)
    }.toString()
    OutputStreamWriter(connection.outputStream).use { it.write(payload) }
    val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
    val text = stream?.bufferedReader()?.readText().orEmpty()
    if (connection.responseCode !in 200..299) {
        val message = runCatching {
            val json = Json.parseToJsonElement(text).jsonObject
            json["msg"]?.jsonPrimitive?.content
                ?: json["message"]?.jsonPrimitive?.content
                ?: json["error_description"]?.jsonPrimitive?.content
                ?: json["error"]?.jsonPrimitive?.content
        }.getOrNull()
        error(message ?: "Supabase 재설정 메일 전송 실패 ${connection.responseCode}: $text")
    }
}

private suspend fun syncDate(client: HealthConnectClient, token: String, date: LocalDate) {
    val payload = readDailyHealthData(client, date)
    uploadToOngirok(token, payload)
}

private suspend fun readDailyHealthData(client: HealthConnectClient, date: LocalDate): JsonObject {
    val zone = ZoneId.systemDefault()
    val start = date.atStartOfDay(zone).toInstant()
    val end = date.plusDays(1).atStartOfDay(zone).toInstant()
    val filter = TimeRangeFilter.between(start, end)

    val steps = client.readRecords(ReadRecordsRequest(StepsRecord::class, filter)).records.sumOf { it.count }
    val distanceKm = client.readRecords(ReadRecordsRequest(DistanceRecord::class, filter)).records.sumOf { it.distance.inKilometers }
    val activeCalories = client.readRecords(ReadRecordsRequest(ActiveCaloriesBurnedRecord::class, filter)).records.sumOf { it.energy.inKilocalories }
    val totalCalories = client.readRecords(ReadRecordsRequest(TotalCaloriesBurnedRecord::class, filter)).records.sumOf { it.energy.inKilocalories }
    val heartRates = client.readRecords(ReadRecordsRequest(HeartRateRecord::class, filter)).records.flatMap { record -> record.samples.map { it.beatsPerMinute } }
    val restingRates = client.readRecords(ReadRecordsRequest(RestingHeartRateRecord::class, filter)).records.map { it.beatsPerMinute }
    val sleepSessions = client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, filter)).records
    val oxygen = client.readRecords(ReadRecordsRequest(OxygenSaturationRecord::class, filter)).records.map { it.percentage.value }
    val workouts = client.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, filter)).records

    val sleepMinutes = sleepSessions.sumOf { Duration.between(it.startTime, it.endTime).toMinutes() }
    val activeMinutes = workouts.sumOf { Duration.between(it.startTime, it.endTime).toMinutes() }

    return buildJsonObject {
        put("date", date.toString())
        put("source", "Health Connect")
        put("provider", "Android Health Connect")
        put("collectedAt", ZonedDateTime.now().toString())
        put("metrics", buildJsonObject {
            put("steps", steps)
            put("distanceKm", round2(distanceKm))
            put("activeCaloriesKcal", round2(activeCalories))
            put("totalCaloriesKcal", round2(totalCalories))
            put("activeMinutes", activeMinutes)
            if (heartRates.isNotEmpty()) {
                put("heartRateAvgBpm", heartRates.average().toLong())
                put("heartRateMaxBpm", heartRates.max())
            }
            if (restingRates.isNotEmpty()) put("restingHeartRateBpm", restingRates.average().toLong())
            if (sleepMinutes > 0) put("sleepHours", round2(sleepMinutes / 60.0))
            if (oxygen.isNotEmpty()) put("bloodOxygenAvgPercent", round2(oxygen.average()))
        })
        put("workouts", buildJsonArray {
            workouts.take(20).forEach { workout ->
                add(buildJsonObject {
                    put("type", workout.exerciseType.toString())
                    put("durationMinutes", Duration.between(workout.startTime, workout.endTime).toMinutes())
                })
            }
        })
        put("sleep", buildJsonObject {
            put("totalMinutes", sleepMinutes)
            put("sessions", JsonArray(sleepSessions.map {
                buildJsonObject {
                    put("startTime", it.startTime.toString())
                    put("endTime", it.endTime.toString())
                }
            }))
        })
    }
}

private suspend fun uploadToOngirok(token: String, payload: JsonObject) = withContext(Dispatchers.IO) {
    require(token.isNotBlank()) { "온기록 로그인이 필요합니다." }
    val baseUrl = BuildConfig.ONGIROK_API_BASE_URL.trimEnd('/')
    val connection = (URL("$baseUrl/api/device-data").openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Authorization", "Bearer $token")
        doOutput = true
    }
    OutputStreamWriter(connection.outputStream).use { it.write(payload.toString()) }
    if (connection.responseCode !in 200..299) {
        val errorText = connection.errorStream?.bufferedReader()?.readText()
        error("온기록 업로드 실패 ${connection.responseCode}: $errorText")
    }
}

private fun round2(value: Double): Double = round(value * 100.0) / 100.0
