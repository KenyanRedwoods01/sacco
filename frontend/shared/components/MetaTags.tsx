import Head from 'next/head';
import { config } from '@lib/config';

interface MetaTagsProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  noIndex?: boolean;
}

export const MetaTags: React.FC<MetaTagsProps> = ({
  title,
  description = config.site.description,
  image = '/images/og-image.jpg',
  url = config.site.url,
  noIndex = false,
}) => {
  const fullTitle = title ? `${title} | ${config.site.name}` : config.site.name;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={config.site.name} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Robots */}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Favicon */}
      <link rel="icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      
      {/* Theme */}
      <meta name="theme-color" content={config.site.theme.primaryColor} />
      <meta name="msapplication-TileColor" content={config.site.theme.primaryColor} />
    </Head>
  );
};
