import { Box, Container, Flex, Grid, Heading, Separator, Text } from '@radix-ui/themes';
import styles from './LandingContent.module.css';

const FEATURES = [
  {
    title: 'Create',
    description:
      'Draft new content in isolated branches without affecting what\'s live. Write, edit, and organize at your own pace — your work stays private until you\'re ready to share.',
  },
  {
    title: 'Review',
    description:
      'Invite teammates to review your changes before they go live. Reviewers can approve, request changes, or leave comments — keeping quality high and everyone aligned.',
  },
  {
    title: 'Publish',
    description:
      'Once approved, content is merged into the main branch and goes live instantly. The full history of every change is preserved, so nothing is ever lost.',
  },
];

const WORKFLOWS = [
  {
    label: 'Branching',
    description:
      'Every piece of work starts with a branch — a private workspace where you can draft, revise, and experiment freely. Branches keep your changes isolated from live content, so you can work without worrying about breaking anything. When you\'re ready, submit your branch for review and let the collaboration begin.',
  },
  {
    label: 'Review & Approval',
    description:
      'Assign reviewers to your branch and gather feedback before anything goes live. Reviewers can approve your changes, request revisions, or leave detailed comments. Configurable approval thresholds ensure the right number of eyes see every update before it reaches your audience.',
  },
  {
    label: 'AI-Assisted Authoring',
    description:
      'Echo integrates AI tools directly into the editing experience. Get help drafting content, refining tone, checking compliance, and analyzing images — all without leaving the platform. AI suggestions are always just that: suggestions. You stay in control of the final output.',
  },
];

export function LandingContent() {
  return (
    <Container size="3" py="8" px="5">
      <Flex direction="column" gap="6">
        {/* Intro heading + paragraph */}
        <Heading size="7" as="h1">
          What is Echo?
        </Heading>
        <Text as="p" size="3" color="gray">
          Echo is a collaborative content platform built for teams that care about quality. Whether
          you're managing design documentation, publishing guidelines, or maintaining a living
          knowledge base, Echo gives your team a structured workflow to create, review, and publish
          content together — with full version history and role-based permissions baked in.
        </Text>

        {/* Large image placeholder */}
        <Box className={styles.imagePlaceholder} />

        {/* Second paragraph */}
        <Text as="p" size="3" color="gray">
          Traditional content workflows often rely on scattered documents, ad-hoc reviews, and
          unclear ownership. Echo replaces that with a single source of truth where every change is
          tracked, every review is recorded, and every contributor knows exactly where things stand.
          It's the calm, organized workspace your team has been looking for.
        </Text>

        <Separator size="4" />

        {/* How it works — 3-column grid */}
        <Heading size="5" as="h2">
          How it works
        </Heading>
        <Text as="p" size="3" color="gray">
          Echo follows a simple create-review-publish cycle that keeps content moving forward without
          sacrificing quality. Each step is designed to give contributors the freedom to do their
          best work while keeping stakeholders in the loop.
        </Text>

        <Grid style={{ gridTemplateColumns: '1fr 1fr 1fr' }} gap="5">
          {FEATURES.map((feature) => (
            <Flex key={feature.title} direction="column" gap="3">
              <Box className={styles.imagePlaceholderSmall} />
              <Text size="2" weight="bold">
                {feature.title}
              </Text>
              <Text size="2" color="gray">
                {feature.description}
              </Text>
            </Flex>
          ))}
        </Grid>

        <Separator size="4" />

        {/* Ways to contribute */}
        <Heading size="5" as="h2">
          Ways to contribute
        </Heading>

        <Flex direction="column" gap="5">
          {WORKFLOWS.map((workflow) => (
            <Grid key={workflow.label} style={{ gridTemplateColumns: '200px 1fr' }} gap="5" align="start">
              <Text size="3" weight="bold">
                {workflow.label}
              </Text>
              <Text size="3" color="gray">
                {workflow.description}
              </Text>
            </Grid>
          ))}
        </Flex>

        <Separator size="4" />

        {/* Getting started */}
        <Heading size="5" as="h2">
          Get started
        </Heading>
        <Text as="p" size="3" color="gray">
          Getting up and running with Echo takes just a few minutes. Sign in, create your first
          branch, and start drafting content right away. There's no complex setup or configuration
          required — Echo is ready when you are.
        </Text>
        <Text as="p" size="3" color="gray">
          Once you've created a branch, you can organize content into sections and categories,
          invite reviewers, and track feedback all in one place. As your team grows, Echo scales
          with you — role-based permissions let you control who can create, review, and publish,
          while the audit trail keeps a complete record of every action.
        </Text>
        <Text as="p" size="3" color="gray">
          Whether you're a solo contributor drafting your first page or an admin overseeing a
          team of publishers, Echo is designed to get out of your way and let you focus on what
          matters: creating great content, together.
        </Text>
      </Flex>
    </Container>
  );
}
