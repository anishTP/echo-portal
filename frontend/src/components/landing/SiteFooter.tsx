import { Box, Container, Flex, Grid, Text } from '@radix-ui/themes';
import styles from './SiteFooter.module.css';

interface FooterColumn {
  heading: string;
  links: string[];
}

const COLUMNS: FooterColumn[] = [
  {
    heading: 'HELP & SUPPORT',
    links: ['Echo Feedback', 'Contact support'],
  },
  {
    heading: 'RESOURCES',
    links: ['Press Kit', 'Brand Assets', 'Product Downloads', 'Release Notes'],
  },
  {
    heading: 'LEGAL',
    links: ['About ECHO', 'Privacy Policy', 'Terms of Use'],
  },
  {
    heading: 'LEGAL',
    links: ['About ECHO', 'Privacy Policy', 'Terms of Use'],
  },
];

export function SiteFooter() {
  return (
    <Box className={styles.footer}>
      <Container size="3" px="5">
        <Flex justify="between" align="start" wrap="wrap" gap="6">
          <Text size="2" color="gray">
            &copy;2026 ECHO
          </Text>

          <Grid columns="4" gap="7">
            {COLUMNS.map((col, i) => (
              <Flex key={i} direction="column" gap="3">
                <Text size="2" weight="bold" color="gray">
                  {col.heading}
                </Text>
                {col.links.map((link) => (
                  <a key={link} href="#" className={styles.footerLink}>
                    <Text size="2">{link}</Text>
                  </a>
                ))}
              </Flex>
            ))}
          </Grid>
        </Flex>
      </Container>
    </Box>
  );
}
