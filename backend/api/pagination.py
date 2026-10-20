from rest_framework.pagination import PageNumberPagination

class OptionalPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 10000

    def paginate_queryset(self, queryset, request, view=None):
        nopage = request.query_params.get('nopage')
        pagination = request.query_params.get('pagination')
        if nopage == 'true' or nopage == '1' or pagination == 'false':
            return None
        return super().paginate_queryset(queryset, request, view=view)
