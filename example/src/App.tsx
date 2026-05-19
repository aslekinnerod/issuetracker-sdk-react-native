import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Issuetracker,
  type SdkErrorReason,
  type TerminatedUiStrings,
} from '@issuetracker/sdk-react-native';

// Replace with a real key from the Issuetracker admin UI. The
// placeholder will trip the SDK's terminal path with invalid_api_key
// on the first report — useful for demoing the TERMINATED flow if
// you leave it in. For day-to-day work, copy this file to
// App.local.tsx (gitignore it) and edit the key there.
const API_KEY = 'it_staging_REPLACE_ME';

const PREF_USE_NORWEGIAN = '@issuetracker.sample.useNorwegianTerminatedUI';
const PREF_LAST_ERROR = '@issuetracker.sample.lastConfigError';
const PREF_LAST_ERROR_AT = '@issuetracker.sample.lastConfigErrorAt';

const NORWEGIAN_STRINGS: TerminatedUiStrings = {
  title: 'Feilrapportering er ikke lenger tilgjengelig.',
  subtitle: 'Kontakt teamet ditt.',
  closeLabel: 'Lukk',
};

/**
 * Single-screen demo. Every meaningful SDK surface gets a section
 * card with one or two affordances + a short explanation, so a
 * person who's never seen the SDK can shake-test it in 30 seconds.
 *
 * Same feature checklist as the Android, iOS, and Flutter sample
 * apps — see example/README.md.
 */
export default function App() {
  const [useNorwegian, setUseNorwegian] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastErrorAt, setLastErrorAt] = useState<number | null>(null);
  const [identityFeedback, setIdentityFeedback] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [recentBreadcrumbs, setRecentBreadcrumbs] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const [n, le, leAt] = await Promise.all([
        AsyncStorage.getItem(PREF_USE_NORWEGIAN),
        AsyncStorage.getItem(PREF_LAST_ERROR),
        AsyncStorage.getItem(PREF_LAST_ERROR_AT),
      ]);
      const norwegian = n === '1';
      setUseNorwegian(norwegian);
      if (le) setLastError(le);
      if (leAt) setLastErrorAt(Number(leAt));
      configureSdk(norwegian);
    })();
  }, []);

  function configureSdk(norwegian: boolean) {
    Issuetracker.configure({
      apiKey: API_KEY,
      shakeToReport: true,
      longPressToReport: true,
      enableCrashReporting: true,
      showOnboarding: true,
      onConfigurationError: (reason: SdkErrorReason) => {
        const at = Date.now();
        setLastError(reason);
        setLastErrorAt(at);
        AsyncStorage.setItem(PREF_LAST_ERROR, reason);
        AsyncStorage.setItem(PREF_LAST_ERROR_AT, String(at));
      },
      terminatedUI: norwegian ? NORWEGIAN_STRINGS : undefined,
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Issuetracker SDK demo</Text>

        <LifecycleSection
          lastError={lastError}
          lastErrorAt={lastErrorAt}
          onReset={async () => {
            await Promise.all([
              AsyncStorage.removeItem(PREF_LAST_ERROR),
              AsyncStorage.removeItem(PREF_LAST_ERROR_AT),
            ]);
            setLastError(null);
            setLastErrorAt(null);
          }}
        />

        <ReportingSection />

        <IdentitySection
          name={name}
          onNameChange={setName}
          feedback={identityFeedback}
          onSave={() => {
            const v = name.trim();
            if (v) {
              Issuetracker.identify(v);
              setIdentityFeedback(`Saved "${v}"`);
            }
          }}
          onClear={() => {
            Issuetracker.clearIdentity();
            setName('');
            setIdentityFeedback('Cleared.');
          }}
        />

        <BreadcrumbSection
          recent={recentBreadcrumbs}
          onRecordViewed={() => {
            Issuetracker.recordAction('viewed_home');
            setRecentBreadcrumbs((prev) =>
              [...prev, 'viewed_home'].slice(-5),
            );
          }}
          onRecordTapped={() => {
            Issuetracker.recordAction('tapped_button', { id: 'settings' });
            setRecentBreadcrumbs((prev) =>
              [...prev, 'tapped_button'].slice(-5),
            );
          }}
        />

        <OnboardingSection />

        <I18nSection
          useNorwegian={useNorwegian}
          onToggle={async (v) => {
            await AsyncStorage.setItem(PREF_USE_NORWEGIAN, v ? '1' : '0');
            setUseNorwegian(v);
            // RN can re-configure without an app restart — the native
            // SDK accepts a new terminatedUI on each call.
            configureSdk(v);
          }}
        />

        <DestructiveSection />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionCard(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{props.title.toUpperCase()}</Text>
      {props.subtitle && (
        <Text style={styles.cardSubtitle}>{props.subtitle}</Text>
      )}
      <View style={styles.cardBody}>{props.children}</View>
    </View>
  );
}

function PrimaryButton({
  title,
  onPress,
  flex,
}: {
  title: string;
  onPress: () => void;
  flex?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        styles.btnPrimary,
        flex && styles.btnFlex,
        pressed && styles.btnPressed,
      ]}
    >
      <Text style={[styles.btnText, styles.btnTextPrimary]}>{title}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  title,
  onPress,
  destructive,
  flex,
}: {
  title: string;
  onPress: () => void;
  destructive?: boolean;
  flex?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        styles.btnSecondary,
        flex && styles.btnFlex,
        pressed && styles.btnPressed,
      ]}
    >
      <Text
        style={[
          styles.btnText,
          destructive ? styles.btnTextDanger : styles.btnTextSecondary,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function LifecycleSection(props: {
  lastError: string | null;
  lastErrorAt: number | null;
  onReset: () => void;
}) {
  const whenStr = useMemo(() => {
    if (!props.lastErrorAt) return null;
    const mins = Math.round((Date.now() - props.lastErrorAt) / 60000);
    return mins < 1 ? 'just now' : `${mins} min ago`;
  }, [props.lastErrorAt]);

  const subtitle = props.lastError
    ? `Last onConfigurationError: ${props.lastError} (${whenStr})`
    : 'Listening for onConfigurationError. Nothing fired yet.';

  return (
    <SectionCard title="Lifecycle" subtitle={subtitle}>
      <SecondaryButton title="Reset last error" onPress={props.onReset} />
    </SectionCard>
  );
}

function ReportingSection() {
  return (
    <SectionCard
      title="Reporting"
      subtitle="Shake the device, two-finger long-press (3s), or tap the button."
    >
      <PrimaryButton title="Report a bug" onPress={() => Issuetracker.report()} />
    </SectionCard>
  );
}

function IdentitySection(props: {
  name: string;
  onNameChange: (v: string) => void;
  feedback: string | null;
  onSave: () => void;
  onClear: () => void;
}) {
  return (
    <SectionCard
      title="Identity"
      subtitle="Skips the in-form name prompt and stamps every report."
    >
      <TextInput
        value={props.name}
        onChangeText={props.onNameChange}
        placeholder="Display name (e.g. Kari Nordmann)"
        placeholderTextColor="#9ca3af"
        style={styles.input}
      />
      <View style={styles.row}>
        <PrimaryButton title="Save" onPress={props.onSave} flex />
        <View style={styles.gap} />
        <SecondaryButton title="Clear" onPress={props.onClear} flex />
      </View>
      {props.feedback && <Text style={styles.muted}>{props.feedback}</Text>}
    </SectionCard>
  );
}

function BreadcrumbSection(props: {
  recent: string[];
  onRecordViewed: () => void;
  onRecordTapped: () => void;
}) {
  return (
    <SectionCard
      title="Breadcrumbs"
      subtitle="Last 5 actions ride along with every report."
    >
      <View style={styles.row}>
        <SecondaryButton
          title="viewed_home"
          onPress={props.onRecordViewed}
          flex
        />
        <View style={styles.gap} />
        <SecondaryButton
          title="tapped_button"
          onPress={props.onRecordTapped}
          flex
        />
      </View>
      {props.recent.length > 0 && (
        <Text style={styles.muted} numberOfLines={2}>
          Recorded: {props.recent.join(' → ')}
        </Text>
      )}
    </SectionCard>
  );
}

function OnboardingSection() {
  return (
    <SectionCard
      title="Onboarding"
      subtitle="Re-show the trigger introduction popover regardless of whether it has been shown before."
    >
      <SecondaryButton
        title="Show intro again"
        onPress={() => Issuetracker.showOnboarding()}
      />
    </SectionCard>
  );
}

function I18nSection(props: {
  useNorwegian: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <SectionCard
      title="TERMINATED-UI i18n"
      subtitle="When ON, the SDK shows the terminal screen in Norwegian. Applied immediately — no restart needed (the native SDK accepts a new terminatedUI on every configure() call)."
    >
      <View style={[styles.row, styles.rowBetween]}>
        <Text style={styles.body}>Norwegian strings</Text>
        <Switch value={props.useNorwegian} onValueChange={props.onToggle} />
      </View>
    </SectionCard>
  );
}

function DestructiveSection() {
  function confirmAndCrash() {
    Alert.alert(
      'Force crash',
      'This will throw and the app process will die. Re-open the app and the SDK will queue a crash report on the next launch.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Crash now',
          style: 'destructive',
          onPress: () => Issuetracker.testCrash(),
        },
      ],
    );
  }
  return (
    <SectionCard
      title="Destructive"
      subtitle="Test the crash-reporting flow. The app will die immediately and the SDK files an issue on next launch."
    >
      <SecondaryButton title="Force crash" onPress={confirmAndCrash} destructive />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f7f9' },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  card: {
    backgroundColor: '#eef0f3',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: '#6b7280',
    marginBottom: 4,
  },
  cardSubtitle: { fontSize: 13, color: '#6b7280', marginBottom: 10 },
  cardBody: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { justifyContent: 'space-between' },
  gap: { width: 8 },
  body: { fontSize: 14, color: '#1f2937' },
  muted: { fontSize: 12, color: '#6b7280' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFlex: { flex: 1 },
  btnPrimary: { backgroundColor: '#1f2937' },
  btnSecondary: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  btnPressed: { opacity: 0.7 },
  btnText: { fontSize: 14, fontWeight: '600' },
  btnTextPrimary: { color: '#ffffff' },
  btnTextSecondary: { color: '#1f2937' },
  btnTextDanger: { color: '#dc2626' },
});
