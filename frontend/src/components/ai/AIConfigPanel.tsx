import { useState, useEffect } from 'react';
import { Card, Button, Badge, TextField, Text, Callout, Heading, Flex, Switch, Box, Separator } from '@radix-ui/themes';
import { api } from '../../services/api.js';
import { AI_DEFAULTS } from '@echo-portal/shared';

interface AIConfig {
  global: Record<string, unknown>;
  roles: Record<string, Record<string, unknown>>;
}

const ROLE_LABELS: Record<string, string> = {
  contributor: 'Contributor',
  reviewer: 'Reviewer',
  administrator: 'Administrator',
};

const ROLES = Object.keys(ROLE_LABELS);

/**
 * AIConfigPanel — Admin component for AI configuration (FR-010, T043)
 *
 * Allows administrators to toggle AI on/off, configure per-role access,
 * and set global quotas.
 */
export function AIConfigPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [maxTokens, setMaxTokens] = useState<number>(AI_DEFAULTS.MAX_TOKENS_PER_REQUEST);
  const [rateLimit, setRateLimit] = useState<number>(AI_DEFAULTS.RATE_LIMIT_PER_HOUR);
  const [maxTurns, setMaxTurns] = useState<number>(AI_DEFAULTS.MAX_TURNS_PER_CONVERSATION);
  const [roleEnabled, setRoleEnabled] = useState<Record<string, boolean>>({});

  // Fetch config on mount
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.get<{ config: AIConfig }>('/ai/config');
      const global = data.config?.global || {};
      setGlobalEnabled(global.enabled !== false);
      if (typeof global.max_tokens === 'number') setMaxTokens(global.max_tokens);
      if (typeof global.rate_limit === 'number') setRateLimit(global.rate_limit);
      if (typeof global.max_turns === 'number') setMaxTurns(global.max_turns);

      const roleEnabledState: Record<string, boolean> = {};
      const roles = data.config?.roles || {};
      for (const role of ROLES) {
        const roleConfig = roles[role];
        if (roleConfig && typeof roleConfig.enabled === 'boolean') {
          roleEnabledState[role] = roleConfig.enabled;
        }
      }
      setRoleEnabled(roleEnabledState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatePayload: {
        global: Record<string, unknown>;
        roles: Record<string, Record<string, unknown>>;
      } = {
        global: {
          enabled: globalEnabled,
          max_tokens: maxTokens,
          rate_limit: rateLimit,
          max_turns: maxTurns,
        },
        roles: {},
      };

      for (const [role, enabled] of Object.entries(roleEnabled)) {
        updatePayload.roles[role] = { enabled };
      }

      // PUT is not on api helper — use fetch directly
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (localStorage.getItem('dev_auth') === 'true') {
        const token = '00000000-0000-0000-0000-000000000001:dev@example.com:contributor,reviewer,publisher,administrator';
        headers['Authorization'] = `Bearer ${token}`;
      }
      const resp = await fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/ai/config`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updatePayload),
        credentials: 'include',
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${resp.status}`);
      }

      setSuccessMessage('AI configuration saved successfully');
      await fetchConfig();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save AI configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleToggle = (role: string, enabled: boolean) => {
    setRoleEnabled((prev) => ({ ...prev, [role]: enabled }));
  };

  if (isLoading) {
    return (
      <Card>
        <Flex align="center" justify="center" py="6">
          <Text color="gray">Loading AI configuration...</Text>
        </Flex>
      </Card>
    );
  }

  return (
    <Card>
      <Heading as="h2" size="4" mb="4">AI Assistant Configuration</Heading>
      <Box mb="4">
        <Text as="p" size="2" color="gray">
          Configure AI assistant settings for all users. Changes take effect immediately.
        </Text>
      </Box>

      <div className="space-y-6">
        {/* Global Enable/Disable */}
        <Box>
          <Flex align="center" justify="between" mb="2">
            <Box>
              <Text as="label" size="2" weight="medium">AI Assistant Status</Text>
              <Text as="p" size="1" color="gray" className="mt-1">
                Enable or disable AI assistant globally
              </Text>
            </Box>
            <Flex align="center" gap="3">
              <Badge color={globalEnabled ? 'green' : 'gray'} size="2">
                {globalEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Switch checked={globalEnabled} onCheckedChange={setGlobalEnabled} disabled={isSaving} />
            </Flex>
          </Flex>
        </Box>

        <Separator size="4" />

        {/* Global Quotas */}
        <Box>
          <Heading as="h3" size="3" mb="3">Global Quotas</Heading>
          <div className="space-y-4">
            <Box>
              <Text as="label" size="2" weight="medium" className="block mb-2">Max Tokens per Request</Text>
              <TextField.Root
                type="number"
                min={100}
                max={100000}
                value={maxTokens.toString()}
                onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || AI_DEFAULTS.MAX_TOKENS_PER_REQUEST)}
                disabled={isSaving}
                style={{ width: '200px' }}
              />
              <Text as="p" size="1" color="gray" className="mt-1">Default: {AI_DEFAULTS.MAX_TOKENS_PER_REQUEST}</Text>
            </Box>
            <Box>
              <Text as="label" size="2" weight="medium" className="block mb-2">Rate Limit (requests/hour)</Text>
              <TextField.Root
                type="number"
                min={1}
                max={1000}
                value={rateLimit.toString()}
                onChange={(e) => setRateLimit(parseInt(e.target.value, 10) || AI_DEFAULTS.RATE_LIMIT_PER_HOUR)}
                disabled={isSaving}
                style={{ width: '200px' }}
              />
              <Text as="p" size="1" color="gray" className="mt-1">Default: {AI_DEFAULTS.RATE_LIMIT_PER_HOUR}</Text>
            </Box>
            <Box>
              <Text as="label" size="2" weight="medium" className="block mb-2">Max Turns per Conversation</Text>
              <TextField.Root
                type="number"
                min={1}
                max={100}
                value={maxTurns.toString()}
                onChange={(e) => setMaxTurns(parseInt(e.target.value, 10) || AI_DEFAULTS.MAX_TURNS_PER_CONVERSATION)}
                disabled={isSaving}
                style={{ width: '200px' }}
              />
              <Text as="p" size="1" color="gray" className="mt-1">Default: {AI_DEFAULTS.MAX_TURNS_PER_CONVERSATION}</Text>
            </Box>
          </div>
        </Box>

        <Separator size="4" />

        {/* Per-Role Configuration */}
        <Box>
          <Heading as="h3" size="3" mb="3">Role-Based Access</Heading>
          <Text as="p" size="2" color="gray" className="mb-3">Override AI access for specific roles</Text>
          <div className="space-y-3">
            {ROLES.map((role) => (
              <Flex key={role} align="center" justify="between" py="2">
                <Text size="2" weight="medium">{ROLE_LABELS[role]}</Text>
                <Flex align="center" gap="3">
                  <Text size="1" color="gray">
                    {roleEnabled[role] === true ? 'Enabled' : roleEnabled[role] === false ? 'Disabled' : 'Default'}
                  </Text>
                  <Switch
                    checked={roleEnabled[role] === true}
                    onCheckedChange={(checked) => handleRoleToggle(role, checked)}
                    disabled={isSaving}
                  />
                </Flex>
              </Flex>
            ))}
          </div>
        </Box>

        {error && (
          <Callout.Root color="red" size="1"><Callout.Text>{error}</Callout.Text></Callout.Root>
        )}
        {successMessage && (
          <Callout.Root color="green" size="1"><Callout.Text>{successMessage}</Callout.Text></Callout.Root>
        )}

        <Flex gap="3" justify="end">
          <Button variant="outline" onClick={fetchConfig} disabled={isSaving}>Reset</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </Flex>
      </div>
    </Card>
  );
}
