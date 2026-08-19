/**
 * TTSControl — Mute/Replay Speaker Icon
 *
 * Small speaker icon (top-right of screen) that lets the user:
 * - Replay the warning on tap
 * - Stop in-progress speech on tap-to-mute
 */

import React, { useState, useCallback } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { warn, stopSpeech, isSpeaking, SupportedLanguage } from '../services/tts';
import { colors, spacing, radius } from '../theme';

interface TTSControlProps {
  /** The text to speak on replay */
  text: string;
  /** Language for TTS */
  lang: SupportedLanguage;
}

export default function TTSControl({ text, lang }: TTSControlProps) {
  const [muted, setMuted] = useState(false);

  const handlePress = useCallback(async () => {
    const speaking = await isSpeaking();

    if (speaking) {
      // Currently speaking → mute
      await stopSpeech();
      setMuted(true);
    } else {
      // Not speaking → replay
      await warn(text, lang);
      setMuted(false);
    }
  }, [text, lang]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>{muted ? '🔇' : '🔊'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: spacing.xxl + spacing.md,
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  icon: {
    fontSize: 22,
  },
});
