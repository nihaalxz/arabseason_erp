from rest_framework import serializers
from .models import CustomUser
from django.contrib.auth.hashers import make_password

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'access_list']
        read_only_fields = ['id', 'username', 'role', 'access_list']

class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'password', 'first_name', 'last_name', 'email', 'role', 'access_list', 'is_active']
        extra_kwargs = {'password': {'write_only': True, 'required': False}}

    def create(self, validated_data):
        if 'password' in validated_data:
            validated_data['password'] = make_password(validated_data['password'])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'password' in validated_data:
            if validated_data['password']:
                validated_data['password'] = make_password(validated_data['password'])
            else:
                validated_data.pop('password')
        return super().update(instance, validated_data)
