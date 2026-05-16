import { useEffect } from 'react';
import {
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Issuetracker } from '@issuetracker/sdk-react-native';

const API_KEY = 'it_staging_replace_with_real_key_from_admin_ui';

export default function App() {
  useEffect(() => {
    Issuetracker.configure({ apiKey: API_KEY });
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h1}>Issuetracker SDK — RN Sample</Text>
        <Text style={styles.body}>
          Shake the device to trigger the reporter, or use the buttons below.
        </Text>

        <View style={styles.row}>
          <Button title="Report a bug" onPress={() => Issuetracker.report()} />
        </View>
        <View style={styles.row}>
          <Button
            title="Record breadcrumb"
            onPress={() => Issuetracker.recordAction('button_tapped')}
          />
        </View>
        <View style={styles.row}>
          <Button
            title="Identify as Alice"
            onPress={() => Issuetracker.identify('Alice Andersen')}
          />
        </View>
        <View style={styles.row}>
          <Button
            title="Clear identity"
            onPress={() => Issuetracker.clearIdentity()}
          />
        </View>
        <View style={styles.row}>
          <Button
            title="Test crash"
            color="#dc2626"
            onPress={() => Issuetracker.testCrash()}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  h1: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  body: { color: '#4b5563', marginBottom: 20 },
  row: { marginVertical: 6 },
});
