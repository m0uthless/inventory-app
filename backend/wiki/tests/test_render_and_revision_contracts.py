import pytest

from wiki.models import WikiCategory, WikiPage, WikiPageRevision


@pytest.fixture
def wiki_page(db, superuser):
    category = WikiCategory.objects.create(name='KB')
    page = WikiPage.objects.create(
        title='Unsafe page',
        slug='unsafe-page',
        category=category,
        summary='Summary',
        content_markdown='<script>alert(1)</script><a href="javascript:alert(1)">x</a><strong>safe</strong>',
        is_published=True,
        created_by=superuser,
        updated_by=superuser,
    )
    return page


@pytest.mark.django_db
class TestWikiRenderAndRevisionContracts:
    def test_render_endpoint_returns_sanitized_html(self, api_client, superuser, wiki_page):
        api_client.force_authenticate(user=superuser)

        res = api_client.get(f'/api/wiki-pages/{wiki_page.id}/render/')

        assert res.status_code == 200
        payload = res.json()
        assert payload['id'] == wiki_page.id
        assert payload['slug'] == 'unsafe-page'
        assert '<script' not in payload['html'].lower()
        assert 'javascript:alert' not in payload['html'].lower()
        assert '<strong>safe</strong>' in payload['html']

    def test_updating_page_creates_revision_and_restore_reverts_content(self, api_client, superuser, wiki_page):
        api_client.force_authenticate(user=superuser)

        update_res = api_client.patch(
            f'/api/wiki-pages/{wiki_page.id}/',
            {
                'title': 'Unsafe page v2',
                'content_markdown': 'New content',
            },
            format='json',
        )
        assert update_res.status_code == 200

        revision = WikiPageRevision.objects.get(page=wiki_page, revision_number=1)
        assert revision.title == 'Unsafe page'
        assert 'alert(1)' in revision.content_markdown

        restore_res = api_client.post(f'/api/wiki-revisions/{revision.id}/restore/')
        assert restore_res.status_code == 200

        wiki_page.refresh_from_db()
        assert wiki_page.title == 'Unsafe page'
        assert 'alert(1)' in wiki_page.content_markdown
        assert WikiPageRevision.objects.filter(page=wiki_page).count() == 2
