import { Box, Container, Flex, Grid, Heading, Separator, Text } from '@radix-ui/themes';
import styles from './LandingContent.module.css';

const LOREM =
  'Lorem ipsum dolor sit amet consectetur. Enim diam massa eget dapibus mollis nisi purus. Eget sed dictum donec lectus. Elit eget vehicula magna in ornare aliquet aenean amet. Nulla consequat varius pharetra tortor sit fames ornare. Integer phasellus feugiat vulputate vitae sit. Id ornare nulla lorem nunc ac tortor vitae. Semper malesuada adipiscing neque cursus metus ac quam egestas. Tempor mauris eget sed facilisis fringilla sed dictumst. Uma adipiscing odio porttitor malesuada cursus ut scelerisque.';

const LOREM_SHORT =
  'Lorem ipsum dolor sit amet consectetur. Enim diam massa eget dapibus mollis nisi purus.';

const TOPIC_DESC =
  'Lorem ipsum dolor sit amet consectetur. Enim diam massa eget dapibus mollis nisi purus. Eget sed dictum donec lectus. Elit eget vehicula magna in ornare aliquet aenean amet. Nulla consequat varius pharetra tortor sit fames ornare. Integer phasellus feugiat vulputate vitae sit.';

const LOREM_CLOSING =
  'Id ornare nulla lorem nunc ac tortor vitae. Semper malesuada adipiscing neque cursus metus ac quam egestas. Tempor mauris eget sed facilisis fringilla sed dictumst. Uma adipiscing odio porttitor malesuada cursus ut scelerisque.';

export function LandingContent() {
  return (
    <Container size="3" py="8" px="5">
      <Flex direction="column" gap="6">
        {/* Intro heading + paragraph */}
        <Heading size="7" as="h1">
          Heading
        </Heading>
        <Text as="p" size="3" color="gray">
          {LOREM}
        </Text>

        {/* Large image placeholder */}
        <Box className={styles.imagePlaceholder} />

        {/* Second paragraph */}
        <Text as="p" size="3" color="gray">
          {LOREM}
        </Text>

        <Separator size="4" />

        {/* Subheading 1 — 3-column grid */}
        <Heading size="5" as="h2">
          Subheading
        </Heading>
        <Text as="p" size="3" color="gray">
          {LOREM}
        </Text>

        <Grid columns="3" gap="5">
          {[1, 2, 3].map((n) => (
            <Flex key={n} direction="column" gap="3">
              <Box className={styles.imagePlaceholderSmall} />
              <Text size="2" color="gray">
                {LOREM_SHORT}
              </Text>
            </Flex>
          ))}
        </Grid>

        <Separator size="4" />

        {/* Subheading 2 — Topic list */}
        <Heading size="5" as="h2">
          Subheading
        </Heading>

        <Flex direction="column" gap="4">
          {['Topic 1', 'Topic 2'].map((topic) => (
            <Grid key={topic} columns="auto 1fr" gap="5" align="start">
              <Text size="3" weight="bold" style={{ minWidth: 80 }}>
                {topic}
              </Text>
              <Text size="3" color="gray">
                {TOPIC_DESC}
              </Text>
            </Grid>
          ))}
        </Flex>

        <Separator size="4" />

        {/* Subheading 3 — Closing section */}
        <Heading size="5" as="h2">
          Subheading
        </Heading>
        <Text as="p" size="3" color="gray">
          {LOREM}
        </Text>
        <Text as="p" size="3" color="gray">
          {LOREM}
        </Text>
        <Text as="p" size="3" color="gray">
          {LOREM_CLOSING}
        </Text>
      </Flex>
    </Container>
  );
}
