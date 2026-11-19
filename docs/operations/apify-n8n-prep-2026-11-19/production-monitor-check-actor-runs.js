const ACTORS = [
  { id: 'alien_force~facebook-scraper-pro', name: 'Facebook Scraper Pro', source: 'facebook' },
  { id: 'mdgjtp1~facebook-group-member', name: 'Facebook Group Member', source: 'facebook' },
  { id: 'apify~facebook-comments-scraper', name: 'Facebook Comments Scraper', source: 'facebook' },
  { id: 'addeus~get-connections', name: 'LinkedIn Connections', source: 'linkedin' },
  { id: 'harvestapi~linkedin-profile-posts', name: 'LinkedIn Profile Posts', source: 'linkedin' },
];
return ACTORS.map(a => ({ json: a }));
